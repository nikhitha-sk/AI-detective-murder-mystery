/**
 * Deterministic character looks. The same suspect (id + name + role) always
 * gets the same face, hair and outfit, so every player sees the same cast.
 */

export type HairStyle = "short" | "slick" | "curly" | "bald" | "long" | "bob" | "bun" | "ponytail" | "spiky" | "waves";
export type Outfit = "suit" | "gown" | "uniform" | "hoodie" | "tee" | "blazer" | "turtleneck" | "labcoat" | "chef";
export type Accessory = "none" | "pearls" | "earrings" | "bowtie" | "tie" | "scarf" | "lanyard" | "headphones" | "flower";

export interface Traits {
  skin: string;
  skinShade: string;
  hair: string;
  hairStyle: HairStyle;
  feminine: boolean;
  age: "young" | "adult" | "old";
  iris: string;
  jaw: number;
  facialHair: "none" | "mustache" | "beard" | "stubble";
  glasses: "none" | "round" | "square";
  outfit: Outfit;
  outfitColor: string;
  accent: string;
  accessory: Accessory;
}

const SKINS: [string, string][] = [
  ["#f6d7c3", "#e2b59c"],
  ["#eec1a0", "#d49f7c"],
  ["#d9a27a", "#bb825b"],
  ["#b97c55", "#9a6240"],
  ["#8d5a3b", "#71452c"],
  ["#5e3b28", "#4a2d1e"],
];
const HAIRS = ["#1c1512", "#2e1f17", "#4a2f1d", "#7a4a26", "#a8742f", "#d8b56a", "#6b2a1a", "#2b2b3a"];
const GREYS = ["#b9b4ae", "#d6d2cc", "#8f8a86"];
const IRISES = ["#3b2a1a", "#4a6b8a", "#3f6b45", "#5a4630", "#2c2c2c"];
const OUTFIT_COLORS = ["#2a2f45", "#3a2340", "#1f3a3a", "#4a2a22", "#2b2b2b", "#30264f", "#47321d", "#203048"];
const ACCENTS = ["#b91c1c", "#a78bfa", "#f5b83d", "#4ade80", "#60a5fa", "#f472b6", "#fb923c"];

const FEMININE = /\b(lady|mrs|miss|ms|madam|madame|duchess|countess|baroness|widow|wife|daughter|niece|sister|mother|aunt|actress|maid|governess|heiress|girlfriend|bride|queen|princess|hostess|waitress|seamstress|matriarch|grandmother)\b/i;
const MASCULINE = /\b(lord|mr|sir|duke|count|baron|butler|nephew|son|brother|father|uncle|husband|boyfriend|widower|groom|king|prince|host|waiter|patriarch|grandfather|colonel|major)\b/i;

/** Which pronouns a description uses for its subject, if it leans clearly one way. */
function pronounLean(text: string): boolean | null {
  const she = (text.match(/\b(she|her|hers|herself)\b/gi) ?? []).length;
  const he = (text.match(/\b(he|him|his|himself)\b/gi) ?? []).length;
  if (she > he) return true;
  if (he > she) return false;
  return null;
}
const OLD = /\b(grand|widow|widower|aging|ageing|retired|elderly|old|dean|colonel|patriarch|matriarch|aunt|uncle|professor|chairman|founder|butler|housekeeper|veteran|senior partner)\b/i;
const YOUNG = /\b(student|intern|fresher|freshman|junior|nephew|niece|son|daughter|volunteer|apprentice|teen|trainee|newcomer|undergrad|maid)\b/i;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, items: readonly T[]): T {
  return items[Math.floor(r() * items.length) % items.length];
}

export function traitsFor(seed: { id: string; name: string; role?: string; theme?: string; bio?: string }): Traits {
  const text = `${seed.name} ${seed.role ?? ""}`;
  const r = rng(hash(`${seed.id}|${seed.name}`));
  const theme = seed.theme ?? "manor-1920s";

  const lean = FEMININE.test(text) ? true : MASCULINE.test(text) ? false : pronounLean(seed.bio ?? "");
  const feminine = lean ?? r() < 0.5;
  const age = OLD.test(text) ? "old" : YOUNG.test(text) ? "young" : theme === "college-fest" ? (r() < 0.75 ? "young" : "adult") : r() < 0.2 ? "old" : "adult";
  const [skin, skinShade] = pick(r, SKINS);
  const hair = age === "old" ? pick(r, GREYS) : pick(r, HAIRS);

  const styles: HairStyle[] = feminine
    ? theme === "manor-1920s"
      ? ["bob", "waves", "bun", "waves", "long"]
      : ["long", "ponytail", "bob", "curly", "bun"]
    : theme === "college-fest"
      ? ["short", "curly", "spiky", "slick"]
      : age === "old"
        ? ["bald", "short", "slick"]
        : ["short", "slick", "curly", "short"];
  const hairStyle = pick(r, styles);

  const role = (seed.role ?? "").toLowerCase();
  let outfit: Outfit;
  if (/doctor|physician|nurse|scientist|chemist|surgeon|lab/.test(role)) outfit = "labcoat";
  else if (/chef|cook|baker/.test(role)) outfit = "chef";
  else if (/butler|maid|housekeeper|valet|footman|chauffeur|waiter|waitress|security|guard/.test(role)) outfit = "uniform";
  else if (theme === "manor-1920s") outfit = feminine ? "gown" : "suit";
  else if (theme === "college-fest") outfit = pick(r, ["hoodie", "tee", "hoodie", "blazer"] as const);
  else outfit = pick(r, ["blazer", "turtleneck", "hoodie", "tee", "blazer"] as const);

  const accessories: Accessory[] =
    outfit === "gown"
      ? ["pearls", "earrings", "flower", "pearls"]
      : outfit === "suit"
        ? ["tie", "bowtie", "tie"]
        : outfit === "uniform"
          ? ["bowtie", "none"]
          : theme === "college-fest"
            ? ["lanyard", "headphones", "scarf", "none"]
            : theme === "startup-office"
              ? ["lanyard", "headphones", "none", "none"]
              : ["none", "scarf"];

  return {
    skin,
    skinShade,
    hair,
    hairStyle,
    feminine,
    age,
    iris: pick(r, IRISES),
    jaw: feminine ? 0.15 + r() * 0.3 : 0.45 + r() * 0.5,
    facialHair: feminine || age === "young" ? "none" : pick(r, ["none", "none", "mustache", "beard", "stubble"] as const),
    glasses: r() < (age === "old" ? 0.45 : 0.22) ? pick(r, ["round", "square"] as const) : "none",
    outfit,
    outfitColor: outfit === "uniform" ? "#15121a" : pick(r, OUTFIT_COLORS),
    accent: pick(r, ACCENTS),
    accessory: pick(r, accessories),
  };
}
