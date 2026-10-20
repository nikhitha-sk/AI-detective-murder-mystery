import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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

/** Opt-in server-side fallback when the main model declines a request for policy reasons. */
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export class LlmRefusalError extends Error {}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Parse structured JSON output and validate it with Zod before anyone uses it. */
function parseJson<T>(message: Anthropic.Beta.BetaMessage, schema: z.ZodType<T>): T {
  if (message.stop_reason === "refusal") throw new LlmRefusalError("The model declined this request");
  if (message.stop_reason === "max_tokens") throw new Error("Structured output was cut off (max_tokens)");
  return schema.parse(JSON.parse(textOf(message)));
}

export class AnthropicProvider implements LlmProvider {
  readonly mode = "anthropic" as const;
  private client: Anthropic;

  constructor(
    apiKey: string | undefined,
    private models: { main: string; guard: string },
  ) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }

  async generateCase(req: CaseRequest) {
    // Long structured output: stream to stay clear of HTTP timeouts.
    const stream = this.client.beta.messages.stream({
      model: this.models.main,
      max_tokens: 32000,
      ...FALLBACK,
      output_config: { effort: "high", format: betaZodOutputFormat(CaseFileSchema) },
      system: CASE_SYSTEM,
      messages: [{ role: "user", content: caseUserPrompt(req) }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new LlmRefusalError("The model declined to write this case");
    if (message.stop_reason === "max_tokens") throw new Error("Case generation was cut off (max_tokens)");
    // Raw JSON only; the generator validates it with CaseFileSchema and the rule checks.
    return { raw: JSON.parse(textOf(message)) as unknown, usage: [usageFrom(this.models.main, message.usage)] };
  }

  async solve(input: SolverInput) {
    const message = await this.client.beta.messages.create({
      model: this.models.main,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(SolverOutputSchema) },
      system: SOLVER_SYSTEM,
      messages: [{ role: "user", content: solverUserPrompt(input) }],
    });
    return {
      result: parseJson(message, SolverOutputSchema),
      usage: [usageFrom(this.models.main, message.usage)],
    };
  }

  async suspectReply(turn: SuspectTurn) {
    const stream = this.client.beta.messages.stream({
      model: this.models.main,
      max_tokens: 4000,
      ...FALLBACK,
      // Conversational turn: low effort keeps latency down.
      output_config: { effort: "low" },
      system: [
        // Stable persona + knowledge slice: cached across this suspect's turns.
        { type: "text", text: suspectSystemPrompt(turn.slice), cache_control: { type: "ephemeral" } },
        { type: "text", text: suspectStatePrompt(turn) },
      ],
      messages: [{ role: "user", content: suspectUserPrompt(turn) }],
    });
    // The draft is never forwarded token-by-token: the guard must approve it first.
    const message = await stream.finalMessage();
    return {
      text: textOf(message),
      refused: message.stop_reason === "refusal",
      usage: [usageFrom(this.models.main, message.usage)],
    };
  }

  async guard(input: GuardInput) {
    const message = await this.client.beta.messages.create({
      model: this.models.guard,
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(GuardOutputSchema) },
      system: GUARD_SYSTEM,
      messages: [{ role: "user", content: guardUserPrompt(input) }],
    });
    const verdict: GuardVerdict = parseJson(message, GuardOutputSchema);
    return { verdict, usage: [usageFrom(this.models.guard, message.usage)] };
  }

  async summarize(name: string, statements: Statement[], previous: string) {
    const message = await this.client.beta.messages.create({
      model: this.models.guard,
      max_tokens: 4000,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: summaryPrompt(name, statements, previous) }],
    });
    return { summary: textOf(message), usage: [usageFrom(this.models.guard, message.usage)] };
  }
}
