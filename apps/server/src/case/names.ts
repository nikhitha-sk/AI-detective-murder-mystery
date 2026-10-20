const TITLES = new Set(["lady", "lord", "doctor", "dr", "mr", "mrs", "miss", "sir", "the"]);

function tokensOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-zÀ-ɏ]+/)
    .filter((t) => t.length >= 3 && !TITLES.has(t));
}

/** Name tokens unique to one person (shared family names are ignored). */
export function distinctiveNameTokens(people: { id: string; name: string }[]): Map<string, string[]> {
  const counts = new Map<string, number>();
  for (const p of people) for (const t of new Set(tokensOf(p.name))) counts.set(t, (counts.get(t) ?? 0) + 1);
  return new Map(people.map((p) => [p.id, tokensOf(p.name).filter((t) => counts.get(t) === 1)]));
}

/** Does `text` mention any of the tokens as a whole word (possessive allowed)? */
export function mentions(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase();
  return tokens.some((t) => new RegExp(`(^|[^a-z])${t}('s)?([^a-z]|$)`).test(lower));
}
