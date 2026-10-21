import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load the repo-root .env (and apps/server/.env if present) without overriding
// variables that are already set in the environment.
const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [path.resolve(here, "../../../.env"), path.resolve(here, "../.env")]) {
  if (fs.existsSync(candidate)) {
    for (const line of fs.readFileSync(candidate, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const int = (def: number) => z.coerce.number().int().positive().default(def);
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const EnvSchema = z.object({
  LLM_PROVIDER: z.enum(["auto", "groq", "anthropic", "mock"]).default("auto"),
  GROQ_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  // Empty = the provider's default (see DEFAULT_MODELS).
  MODEL_MAIN: optionalString,
  MODEL_SUSPECT: optionalString,
  MODEL_GUARD: optionalString,
  MODEL_SOLVER: optionalString,
  SERVER_PORT: int(4300),
  CLIENT_ORIGIN: z.string().default("http://localhost:3300"),
  REDIS_URL: optionalString,
  DATABASE_URL: optionalString,
  ROUNDS: int(3),
  BRIEFING_SECONDS: int(60),
  ROUND_SECONDS: int(240),
  DISCUSSION_SECONDS: int(120),
  VOTE_SECONDS: int(60),
  QUESTIONS_PER_ROUND: int(6),
  ROOM_TOKEN_BUDGET: int(600_000),
});

const env = EnvSchema.parse(process.env);

const llmMode: "groq" | "anthropic" | "mock" =
  env.LLM_PROVIDER !== "auto"
    ? env.LLM_PROVIDER
    : env.GROQ_API_KEY
      ? "groq"
      : env.ANTHROPIC_API_KEY
        ? "anthropic"
        : "mock";

/**
 * main: case generation. solver: the fairness check on a new case. suspect: suspect replies.
 * guard: reply guard, summaries and new settings.
 * On Groq, free-tier limits are per model (8k tokens/min each), so case generation and the
 * solver run on different models: back to back on one model they overrun its limit.
 */
const DEFAULT_MODELS = {
  groq: { main: "openai/gpt-oss-120b", solver: "openai/gpt-oss-20b", suspect: "qwen/qwen3.8-27b", guard: "openai/gpt-oss-20b" },
  anthropic: { main: "claude-opus-5-5", solver: "claude-opus-5-5", suspect: "claude-opus-5-5", guard: "claude-haiku-5-5" },
  mock: { main: "mock", solver: "mock", suspect: "mock", guard: "mock" },
}[llmMode];

export const config = {
  llmMode,
  groqApiKey: env.GROQ_API_KEY,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  modelMain: env.MODEL_MAIN ?? DEFAULT_MODELS.main,
  modelSuspect: env.MODEL_SUSPECT ?? DEFAULT_MODELS.suspect,
  modelGuard: env.MODEL_GUARD ?? DEFAULT_MODELS.guard,
  modelSolver: env.MODEL_SOLVER ?? DEFAULT_MODELS.solver,
  port: env.SERVER_PORT,
  clientOrigins: env.CLIENT_ORIGIN.split(",").map((s) => s.trim()),
  redisUrl: env.REDIS_URL,
  databaseUrl: env.DATABASE_URL,
  rules: {
    rounds: env.ROUNDS,
    briefingSeconds: env.BRIEFING_SECONDS,
    roundSeconds: env.ROUND_SECONDS,
    discussionSeconds: env.DISCUSSION_SECONDS,
    voteSeconds: env.VOTE_SECONDS,
    questionsPerRound: env.QUESTIONS_PER_ROUND,
    roomTokenBudget: env.ROOM_TOKEN_BUDGET,
    maxPlayers: 6,
    maxCaseAttempts: 3,
    /** Seconds a player must wait between questions. */
    askCooldownSeconds: 3,
    /** Killer stress needed (with a key clue presented) before a confession is allowed. */
    confessionStress: 80,
    roomTtlSeconds: 6 * 60 * 60,
  },
};

export type Config = typeof config;
export type GameRules = Config["rules"];
