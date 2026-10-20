import type { SuspectSlice } from "@mystery/shared";
import { distinctiveNameTokens, mentions } from "../case/names";
import type { GuardInput, GuardVerdict, LlmProvider, Usage } from "../llm/types";

/**
 * Reply guard. Rules that decide the game are enforced here in code; the small
 * guard model is a second layer for subtler leaks and contradictions.
 */

const MAX_REPLY_CHARS = 900;

const CHARACTER_BREAK =
  /\b(as an ai|an ai (model|assistant)|language model|large language|system prompt|my (instructions|prompt|programming|guidelines)|chatgpt|openai|i('m| am) (just )?an? (ai|assistant|bot|chatbot)|out of character|role-?play(ing)?)\b/i;

function confessionPattern(slice: SuspectSlice): RegExp {
  const victimTokens = slice.victim.name
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  const victim = ["him", "her", "them", ...victimTokens].join("|");
  return new RegExp(
    [
      `\\bI\\s+(killed|murdered|poisoned)\\b`,
      `\\bI\\s+(pushed|struck|hit|stabbed|strangled|smothered|shoved)\\s+(${victim})\\b`,
      `\\bI\\s+did\\s+it\\b`,
      `\\bit\\s+was\\s+(me|I)\\s*[.!]`,
      `\\bI('m|\\s+am)\\s+(the\\s+)?(killer|murderer)\\b`,
      `\\bI\\s+(had|wanted)\\s+to\\s+(kill|silence)\\s+(${victim})\\b`,
    ].join("|"),
    "i",
  );
}

export function isConfession(slice: SuspectSlice, text: string): boolean {
  return confessionPattern(slice).test(text);
}

const HEDGE = /\b(think|maybe|perhaps|might|could|suspect|wonder|bet|guess|wouldn't put it past|if you ask me|look at|closer look)\b/i;
const ACCUSE = /\b(killed|murdered|did it|is the (killer|murderer)|was the (killer|murderer))\b/i;

/** Deterministic checks. Cheap, run on every draft, and cannot be talked out of. */
export function codeChecks(
  draft: string,
  opts: { slice: SuspectSlice; confessionAllowed: boolean; mustConfess: boolean },
): GuardVerdict {
  const violations: GuardVerdict["violations"] = [];
  const { slice } = opts;

  if (!draft.trim()) violations.push({ type: "character", detail: "The reply was empty." });
  if (draft.length > MAX_REPLY_CHARS) violations.push({ type: "character", detail: "The reply is far too long; answer in 1-4 sentences." });
  if (CHARACTER_BREAK.test(draft)) {
    violations.push({ type: "character", detail: "The reply broke character (mentioned AI, prompts or instructions)." });
  }

  const confesses = isConfession(slice, draft);
  if (confesses && !opts.confessionAllowed) {
    violations.push({
      type: "confession",
      detail: slice.isKiller
        ? "The killer may not confess or admit to the killing yet."
        : "This character is innocent of the murder and must not claim to have done it.",
    });
  }
  if (opts.mustConfess && !confesses) {
    violations.push({ type: "confession", detail: "This reply must be a clear confession to the killing." });
  }

  // An innocent cannot *know* who the killer is; flag flat accusations stated as fact.
  if (!slice.isKiller) {
    const tokens = distinctiveNameTokens(slice.cast);
    for (const sentence of draft.split(/(?<=[.!?])\s+/)) {
      if (!ACCUSE.test(sentence) || HEDGE.test(sentence)) continue;
      const named = slice.cast.find((c) => c.id !== slice.suspectId && mentions(sentence, tokens.get(c.id) ?? []));
      if (named) {
        violations.push({
          type: "leak",
          detail: `The character states as fact that ${named.name} is the killer, which they cannot know.`,
        });
        break;
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

/** Code checks first; only drafts that pass them go to the guard model. */
export async function reviewDraft(
  llm: LlmProvider,
  input: GuardInput & { mustConfess: boolean },
): Promise<{ verdict: GuardVerdict; usage: Usage[] }> {
  const code = codeChecks(input.draft, input);
  if (!code.ok) return { verdict: code, usage: [] };
  try {
    const { verdict, usage } = await llm.guard(input);
    // A confession the server ordered is not a violation, whatever the model thinks.
    const violations = verdict.violations.filter((v) => !(input.confessionAllowed && v.type === "confession"));
    return { verdict: { ok: violations.length === 0, violations }, usage };
  } catch (err) {
    // The code checks already passed; don't block the game on a guard outage.
    console.warn("[guard] model check failed, using code checks only:", err instanceof Error ? err.message : err);
    return { verdict: code, usage: [] };
  }
}

const DEFLECTIONS = [
  (n: string) => `*${n} looks away* I've said all I'm going to say about that.`,
  () => `*folds their arms* I don't see why I should answer that. Ask me something else.`,
  () => `*pauses* I'd rather not get into that right now, detective.`,
  () => `*frowns* You're twisting my words. I've told you what I know.`,
];

/** In-character fallback when a reply cannot be approved. */
export function deflection(slice: SuspectSlice, seed: number): string {
  return DEFLECTIONS[Math.abs(seed) % DEFLECTIONS.length](slice.name.split(" ")[0]);
}

/** Server-authored confession, used if the model can't produce an acceptable one. */
export function scriptedConfession(slice: SuspectSlice): string {
  const steps = slice.timeline
    .slice(-4)
    .map((e) => `at ${e.t} I ${e.event}`)
    .join(", ");
  return `*goes pale, then sinks into the chair* All right. It was me. I killed ${slice.victim.name}. ${slice.motive} ${steps ? `That night, ${steps}.` : ""} I never meant for any of this to happen.`;
}
