import { z } from "zod";

/** The illustrated backdrops the client can draw. Every setting uses one of them. */
export const SCENES = ["manor", "fest", "office"] as const;
export type SceneStyle = (typeof SCENES)[number];

export interface Theme {
  id: string;
  label: string;
  blurb: string;
  scene: SceneStyle;
}

export const THEMES = [
  {
    id: "manor-1920s",
    label: "1920s Manor",
    blurb: "Jazz records, a thunderstorm and a family fortune in a country house.",
    scene: "manor",
  },
  {
    id: "college-fest",
    label: "College Fest",
    blurb: "Three days of music, rivalries and sleepless organisers on campus.",
    scene: "fest",
  },
  {
    id: "startup-office",
    label: "Startup Office",
    blurb: "A late-night launch, a funding round and too much cold coffee.",
    scene: "office",
  },
  {
    id: "hill-hotel",
    label: "Hill Station Hotel",
    blurb: "A monsoon landslide cuts off an old colonial hotel high in the Western Ghats.",
    scene: "manor",
  },
  {
    id: "film-premiere",
    label: "Film Premiere",
    blurb: "Red carpet, flashbulbs and a star who never makes it to the after-party.",
    scene: "fest",
  },
  {
    id: "newsroom",
    label: "Election Night Newsroom",
    blurb: "Results pour in, the front page locks at midnight and the editor is dead.",
    scene: "office",
  },
] as const satisfies readonly Theme[];

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];

/** AI-generated settings: the id carries the backdrop, so a bare id is enough to draw the scene. */
export const GENERATED_THEME_ID = /^gen-(manor|fest|office)-[a-z0-9-]{1,64}$/;

export const CustomThemeSchema = z
  .object({
    id: z.string().regex(GENERATED_THEME_ID),
    label: z.string().trim().min(2).max(40),
    blurb: z.string().trim().max(160).default(""),
    scene: z.enum(SCENES),
  })
  .refine((t) => t.id.startsWith(`gen-${t.scene}-`), "Theme id does not match its scene");

/** What a client sends to pick a setting: a built-in id, or a generated setting in full. */
export const ThemeInputSchema = z.union([z.enum(THEME_IDS), CustomThemeSchema]);
export type ThemeInput = z.input<typeof ThemeInputSchema>;

export function isBuiltInTheme(id: string): id is ThemeId {
  return (THEME_IDS as readonly string[]).includes(id);
}

export function sceneOf(id: string): SceneStyle {
  const builtIn = THEMES.find((t) => t.id === id);
  if (builtIn) return builtIn.scene;
  const m = id.match(GENERATED_THEME_ID);
  return m ? (m[1] as SceneStyle) : "manor";
}

/** A built-in theme, or a best-effort stand-in for an id we only know by name. */
export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? { id, label: id, blurb: "", scene: sceneOf(id) };
}

export function resolveTheme(input: z.output<typeof ThemeInputSchema>): Theme {
  return typeof input === "string" ? themeById(input) : input;
}

/** The smallest payload that picks `theme` on the server. */
export function themeInput(theme: Theme): ThemeInput {
  return isBuiltInTheme(theme.id) ? theme.id : theme;
}

export function themeLabel(id: string): string {
  return themeById(id).label;
}
