import { CaseFileSchema } from "@mystery/shared";
import { z } from "zod";
import {
  CASE_SYSTEM,
  GUARD_SYSTEM,
  SOLVER_SYSTEM,
  caseUserPrompt,
  guardUserPrompt,
  solverUserPrompt,
  summaryPrompt,
  suspectStatePrompt,
  suspectSystemPrompt,
  suspectUserPrompt,
} from "../agents/prompts";
import { usageFrom } from "./pricing";
import type { CaseRequest, GuardInput, GuardVerdict, LlmProvider, SolverInput, Statement, SuspectTurn } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Models with strict json_schema output on Groq. Others get JSON object mode plus the schema in the prompt. */
const STRICT_JSON = /^(openai\/gpt-oss-(20b|120b)$|qwen\/|meta-models\/)/;
/** Reasoning models that accept `reasoning_effort`. */
const REASONING = /^openai\/gpt-oss/;

/** Wait for a rate limit to reset only if it is this short; longer waits fail fast instead of stalling a turn. */
const MAX_RETRY_WAIT_S = 20;
const MAX_ATTEMPTS = 3;

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

export class GroqRateLimitError extends Error {}

interface ChatRequest {
  model: string;
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

export class GroqProvider implements LlmProvider {
  readonly mode = "groq" as const;

  constructor(
    private apiKey: string,
    private models: { main: string; suspect: string; guard: string },
  ) {}

  private async chat(req: ChatRequest) {
    let system = req.system ?? "";
    const body: Record<string, unknown> = {
      model: req.model,
      max_completion_tokens: req.maxTokens,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.effort && REASONING.test(req.model)) body.reasoning_effort = req.effort;
    if (req.schema) {
      const schema = jsonSchema(req.schema.zod);
      if (STRICT_JSON.test(req.model)) {
        body.response_format = { type: "json_schema", json_schema: { name: req.schema.name, strict: true, schema } };
      } else {
        body.response_format = { type: "json_object" };
        system += `\n\nReply with a single JSON object that matches this JSON Schema:\n${JSON.stringify(schema)}`;
      }
    }
    body.messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: req.user },
    ];

    for (let attempt = 1; ; attempt++) {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as ChatResponse;
        const choice = data.choices[0];
        const usage = usageFrom(req.model, {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        });
        return { text: (choice?.message.content ?? "").trim(), finish: choice?.finish_reason ?? "", usage };
      }

      const detail = await res.text();
      const retryAfter = Number(res.headers.get("retry-after") ?? 2);
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS && retryAfter <= MAX_RETRY_WAIT_S) {
        await sleep(retryAfter * 1000);
        continue;
      }
      if (res.status === 429) {
        throw new GroqRateLimitError(`Groq rate limit reached for ${req.model} (retry in ${retryAfter}s): ${detail}`);
      }
      throw new Error(`Groq API error ${res.status} for ${req.model}: ${detail}`);
    }
  }

  /** Parse JSON output and validate it with Zod before anyone uses it. */
  private async chatJson<T>(req: ChatRequest & { schema: { name: string; zod: z.ZodType<T> } }) {
    const { text, finish, usage } = await this.chat(req);
    if (finish === "length") throw new Error(`Structured output from ${req.model} was cut off (max tokens)`);
    return { value: JSON.parse(text) as unknown, usage };
  }

  async generateCase(req: CaseRequest) {
    const { value, usage } = await this.chatJson({
      model: this.models.main,
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
      model: this.models.main,
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
      model: this.models.suspect,
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
      model: this.models.guard,
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
      model: this.models.guard,
      user: summaryPrompt(name, statements, previous),
      maxTokens: 1500,
      effort: "low",
    });
    return { summary: text, usage: [usage] };
  }
}
