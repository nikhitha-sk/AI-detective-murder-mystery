import type { Config } from "../config";
import { AnthropicProvider } from "./anthropic";
import { GroqProvider } from "./groq";
import { MockProvider } from "./mock";
import type { LlmProvider } from "./types";

export function createLlm(config: Config): LlmProvider {
  const models = { main: config.modelMain, suspect: config.modelSuspect, guard: config.modelGuard };
  if (config.llmMode === "mock") return new MockProvider();
  if (config.llmMode === "groq") {
    if (!config.groqApiKey) throw new Error("LLM_PROVIDER=groq needs GROQ_API_KEY in .env");
    return new GroqProvider(config.groqApiKey, models);
  }
  return new AnthropicProvider(config.anthropicApiKey, models);
}

export type { LlmProvider } from "./types";
