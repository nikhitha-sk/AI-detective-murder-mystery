export const THEMES = [
  {
    id: "manor-1920s",
    label: "1920s Manor",
    blurb: "Jazz records, a thunderstorm and a family fortune in a country house.",
  },
  {
    id: "college-fest",
    label: "College Fest",
    blurb: "Three days of music, rivalries and sleepless organisers on campus.",
  },
  {
    id: "startup-office",
    label: "Startup Office",
    blurb: "A late-night launch, a funding round and too much cold coffee.",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];

export function themeLabel(id: string): string {
  return THEMES.find((t) => t.id === id)?.label ?? id;
}
