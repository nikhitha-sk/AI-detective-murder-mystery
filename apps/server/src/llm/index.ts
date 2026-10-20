import type { Config } from "../config";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { LlmProvider } from "./types";

export function createLlm(config: Config): LlmProvider {
  if (config.llmMode === "mock") return new MockProvider();
  return new AnthropicProvider(config.anthropicApiKey, { main: config.modelMain, guard: config.modelGuard });
}

export type { LlmProvider } from "./types";
