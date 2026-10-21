import { CaseFileSchema } from "@mystery/shared";
import { z } from "zod";
import {
  CASE_SYSTEM,
  GUARD_SYSTEM,
  SOLVER_SYSTEM,
  THEMES_SYSTEM,
  caseUserPrompt,
  guardUserPrompt,
  solverUserPrompt,
  summaryPrompt,
  suspectStatePrompt,
  suspectSystemPrompt,
  suspectUserPrompt,
  themesUserPrompt,
} from "../agents/prompts";
import { usageFrom } from "./pricing";
import { ThemeIdeasSchema } from "../case/themes";
import { RateLimitError } from "./types";
import type { CaseRequest, GuardInput, GuardVerdict, LlmProvider, SolverInput, Statement, SuspectTurn } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Models with strict json_schema output on Groq. Others get JSON object mode plus the schema in the prompt. */
const STRICT_JSON = /^(openai\/gpt-oss-(20b|120b)$|qwen\/|meta-models\/)/;
/** Reasoning models that accept `reasoning_effort`. */
const REASONING = /^openai\/gpt-oss/;

/** Live turns (a player is waiting) wait at most this long for a rate limit to reset. */
const LIVE_WAIT_S = 20;
/** Background work (case setup) may wait this long, since failing would waste the whole attempt. */
const BACKGROUND_WAIT_S = 65;
/** Rounds of "try every model, then wait for the soonest to reset". */
const MAX_ROUNDS = 3;

const SolverOutputSchema = z.object({
  suspectId: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

const GuardOutputSchema = z.object({
  ok: z.boolean(),
  violations: z.array(
    z.object({
      type: z.enum(["leak", "confession", "contradiction", "character"]),
      detail: z.string(),
    }),
  ),
});

export class GroqRateLimitError extends RateLimitError {}

interface ChatRequest {
  /**
   * Models to try in order. Each Groq model has its own free-tier rate limit,
   * so when one is exhausted the next one picks up the call instead of failing.
   */
  models: string[];
  /** Longest wait for a rate limit to reset when every model is exhausted. */
  maxWaitS?: number;
  system?: string;
  user: string;
  /** Kept small: on the free tier, prompt + max tokens must fit in the model's tokens-per-minute limit. */
  maxTokens: number;
  effort?: "low" | "medium" | "high";
  temperature?: number;
  schema?: { name: string; zod: z.ZodType };
}

interface ChatResponse {
  choices: { message: { content: string | null }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

/** Zod -> JSON Schema, minus the keywords Groq's structured outputs don't accept. */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => !["$schema", "minimum", "maximum"].includes(k))
        .map(([k, v]) => [k, strip(v)]),
    );
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Attempt =
  | { ok: true; text: string; finish: string; usage: ReturnType<typeof usageFrom> }
  | { ok: false; retryAfterS: number; detail: string }
  /** The model couldn't produce valid output for this request: try the next model, no cooldown. */
  | { ok: false; unusable: true; detail: string };

export class GroqProvider implements LlmProvider {
  readonly mode = "groq" as const;
  /** When each model's rate limit resets, learned from 429s, so later calls skip it without a wasted request. */
  private coolingUntil = new Map<string, number>();

  constructor(
    private apiKey: string,
    private models: { main: string; suspect: string; guard: string; solver: string },
  ) {}

  /** `preferred` in order, then the other models as fallbacks (each has its own rate limit). */
  private chain(...preferred: string[]) {
    return [...new Set([...preferred, this.models.guard, this.models.main, this.models.suspect])];
  }

  private body(model: string, req: ChatRequest) {
    let system = req.system ?? "";
    const body: Record<string, unknown> = { model, max_completion_tokens: req.maxTokens };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.effort && REASONING.test(model)) body.reasoning_effort = req.effort;
    if (req.schema) {
      const schema = jsonSchema(req.schema.zod);
      if (STRICT_JSON.test(model)) {
        body.response_format = { type: "json_schema", json_schema: { name: req.schema.name, strict: true, schema } };
      } else {
        body.response_format = { type: "json_object" };
        system += `\n\nReply with a single JSON object that matches this JSON Schema:\n${JSON.stringify(schema)}`;
      }
    }
    body.messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: req.user }];
    return body;
  }

  private async send(model: string, req: ChatRequest): Promise<Attempt> {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(this.body(model, req)),
    });
    if (res.ok) {
      const data = (await res.json()) as ChatResponse;
      const choice = data.choices[0];
      const usage = usageFrom(model, {
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
      });
      return { ok: true, text: (choice?.message.content ?? "").trim(), finish: choice?.finish_reason ?? "", usage };
    }
    const detail = await res.text();
    if (res.status === 429 || res.status >= 500) {
      // retry-after is in seconds; a 5xx gets a short pause before this model is tried again.
      const retryAfterS = res.status === 429 ? Math.max(1, Number(res.headers.get("retry-after")) || 10) : 2;
      return { ok: false, retryAfterS, detail: `${res.status} from ${model}: ${detail}` };
    }
    // Strict JSON mode rejects output that doesn't fit the schema (smaller models fail on big schemas).
    if (res.status === 400 && detail.includes("json_validate_failed")) {
      return { ok: false, unusable: true, detail: `${model} could not produce valid JSON for this request` };
    }
    throw new Error(`Groq API error ${res.status} for ${model}: ${detail}`);
  }

  private async chat(req: ChatRequest) {
    const maxWaitS = req.maxWaitS ?? LIVE_WAIT_S;
    let lastDetail = "";
    const unusable = new Set<string>();
    for (let round = 1; ; round++) {
      for (const model of req.models) {
        if (unusable.has(model) || (this.coolingUntil.get(model) ?? 0) > Date.now()) continue;
        const attempt = await this.send(model, req);
        if (attempt.ok) return attempt;
        lastDetail = attempt.detail;
        if ("unusable" in attempt) unusable.add(model);
        else this.coolingUntil.set(model, Date.now() + attempt.retryAfterS * 1000);
      }
      const usable = req.models.filter((m) => !unusable.has(m));
      if (!usable.length) throw new Error(`No model could answer this request. ${lastDetail}`);
      // Every usable model is cooling down: wait for the first to reset, if that is soon enough.
      const soonest = Math.min(...usable.map((m) => this.coolingUntil.get(m) ?? 0));
      const waitS = Math.max(0, Math.ceil((soonest - Date.now()) / 1000));
      if (round >= MAX_ROUNDS || waitS > maxWaitS) {
        throw new GroqRateLimitError(
          `Groq's free-tier rate limit is used up on every model (next one frees up in ${waitS}s). ` +
            `Wait a minute and try again.${lastDetail ? ` Last error: ${lastDetail}` : ""}`,
          waitS,
        );
      }
      await sleep(waitS * 1000 + 250);
    }
  }

  /** Parse JSON output and validate it with Zod before anyone uses it. */
  private async chatJson<T>(req: ChatRequest & { schema: { name: string; zod: z.ZodType<T> } }) {
    const { text, finish, usage } = await this.chat(req);
    if (finish === "length") throw new Error(`Structured output from ${usage.model} was cut off (max tokens)`);
    return { value: JSON.parse(text) as unknown, usage };
  }

  async generateCase(req: CaseRequest) {
    const { value, usage } = await this.chatJson({
      // Fallbacks big enough for a whole case first: gpt-oss-20b can't fill the case schema in strict JSON mode.
      models: this.chain(this.models.main, this.models.suspect),
      maxWaitS: BACKGROUND_WAIT_S,
      system: CASE_SYSTEM,
      user: caseUserPrompt(req),
      maxTokens: 6000,
      effort: "medium",
      schema: { name: "case_file", zod: CaseFileSchema },
    });
    // Raw JSON only; the generator validates it with CaseFileSchema and the rule checks.
    return { raw: value, usage: [usage] };
  }

  async solve(input: SolverInput) {
    const { value, usage } = await this.chatJson({
      // A different model from case generation, so the two don't share one rate limit.
      models: this.chain(this.models.solver),
      maxWaitS: BACKGROUND_WAIT_S,
      system: SOLVER_SYSTEM,
      user: solverUserPrompt(input),
      maxTokens: 2500,
      effort: "medium",
      schema: { name: "solver_answer", zod: SolverOutputSchema },
    });
    return { result: SolverOutputSchema.parse(value), usage: [usage] };
  }

  async suspectReply(turn: SuspectTurn) {
    // The draft is never forwarded token-by-token: the guard must approve it first.
    const { text, finish, usage } = await this.chat({
      models: this.chain(this.models.suspect),
      system: `${suspectSystemPrompt(turn.slice)}\n\n${suspectStatePrompt(turn)}`,
      user: suspectUserPrompt(turn),
      maxTokens: 1500,
      effort: "low",
      temperature: 0.8,
    });
    return { text, refused: !text || finish === "content_filter", usage: [usage] };
  }

  async guard(input: GuardInput) {
    const { value, usage } = await this.chatJson({
      models: this.chain(this.models.guard),
      system: GUARD_SYSTEM,
      user: guardUserPrompt(input),
      maxTokens: 1500,
      effort: "low",
      schema: { name: "guard_verdict", zod: GuardOutputSchema },
    });
    const verdict: GuardVerdict = GuardOutputSchema.parse(value);
    return { verdict, usage: [usage] };
  }

  async summarize(name: string, statements: Statement[], previous: string) {
    const { text, usage } = await this.chat({
      models: this.chain(this.models.guard),
      user: summaryPrompt(name, statements, previous),
      maxTokens: 1500,
      effort: "low",
    });
    return { summary: text, usage: [usage] };
  }

  async generateThemes(avoid: string[], count: number) {
    const { value, usage } = await this.chatJson({
      // Small, fast model: this is a quick creative list, not a whole case.
      models: this.chain(this.models.guard),
      system: THEMES_SYSTEM,
      user: themesUserPrompt(avoid, count),
      maxTokens: 1500,
      effort: "low",
      temperature: 1,
      schema: { name: "settings", zod: ThemeIdeasSchema },
    });
    return { ideas: ThemeIdeasSchema.parse(value).settings, usage: [usage] };
  }
}
