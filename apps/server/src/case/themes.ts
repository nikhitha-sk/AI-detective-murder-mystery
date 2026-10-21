import { randomBytes } from "node:crypto";
import { CustomThemeSchema, SCENES, THEMES, type Theme } from "@mystery/shared";
import { z } from "zod";
import type { LlmProvider, Usage } from "../llm/types";

/** Structured output for setting ideas. No length limits here: Groq's strict mode rejects them, so we trim afterwards. */
export const ThemeIdeasSchema = z.object({
  settings: z.array(
    z.object({
      label: z.string(),
      blurb: z.string(),
      scene: z.enum(SCENES),
    }),
  ),
});

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "setting";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Ask the model for new settings, then keep only valid, new ones. The ids
 * carry the backdrop (gen-<scene>-<slug>-<random>), so clients can draw them
 * without a lookup.
 */
export async function generateThemes(
  llm: LlmProvider,
  avoid: string[],
  count = 3,
): Promise<{ themes: Theme[]; usage: Usage[] }> {
  const { ideas, usage } = await llm.generateThemes([...THEMES.map((t) => t.label), ...avoid], count);
  const seen = new Set([...THEMES.map((t) => norm(t.label)), ...avoid.map(norm)]);
  const themes: Theme[] = [];
  for (const idea of ideas) {
    const label = idea.label.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!label || seen.has(norm(label))) continue;
    const scene = (SCENES as readonly string[]).includes(idea.scene) ? idea.scene : "manor";
    const parsed = CustomThemeSchema.safeParse({
      id: `gen-${scene}-${slug(label)}-${randomBytes(2).toString("hex")}`,
      label,
      blurb: idea.blurb.trim().slice(0, 160),
      scene,
    });
    if (!parsed.success) continue;
    seen.add(norm(label));
    themes.push(parsed.data);
    if (themes.length === count) break;
  }
  return { themes, usage };
}
