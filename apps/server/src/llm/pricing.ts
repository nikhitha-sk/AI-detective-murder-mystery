import type { Usage } from "./types";

/** USD per million tokens (input, output). Used to report cost per game. */
const PRICES: Record<string, [number, number]> = {
  "claude-fable-5-1": [10, 50],
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export function usageFrom(
  model: string,
  u: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): Usage {
  const [inPrice, outPrice] = PRICES[model] ?? [0, 0];
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const inputTokens = u.input_tokens + cacheWrite + cacheRead;
  const costUsd =
    (u.input_tokens * inPrice + cacheWrite * inPrice * 1.25 + cacheRead * inPrice * 0.1 + u.output_tokens * outPrice) /
    1_000_000;
  return { model, inputTokens, outputTokens: u.output_tokens, costUsd };
}

export function totalTokens(usage: Usage[]): number {
  return usage.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0);
}

export function totalCost(usage: Usage[]): number {
  return usage.reduce((n, u) => n + u.costUsd, 0);
}
