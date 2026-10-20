import type { PublicSuspect } from "@mystery/shared";
import type { UiMessage } from "@/store/game";

/**
 * Reads a suspect's mood from what they just said (stage directions first)
 * and their current nerves, so portraits react to the conversation.
 */

export type Expression =
  | "neutral"
  | "calm"
  | "thinking"
  | "nervous"
  | "scared"
  | "angry"
  | "smug"
  | "sad"
  | "surprised"
  | "broken"
  | "relieved";

export const EXPRESSION_LABEL: Record<Expression, string> = {
  neutral: "guarded",
  calm: "composed",
  thinking: "thinking...",
  nervous: "nervous",
  scared: "frightened",
  angry: "angry",
  smug: "smug",
  sad: "upset",
  surprised: "caught off guard",
  broken: "broken",
  relieved: "relieved",
};

const CUES: [Expression, RegExp][] = [
  ["broken", /\b(breaks down|broke down|collaps|sobbing|enough\.|it was me|i killed|i did it)\b/i],
  ["angry", /\b(glar|snap|slam|scowl|furious|anger|angr|seeth|clench|how dare|outrage|bristl|indignant|hiss|jaw tighten|narrow)/i],
  ["scared", /\b(trembl|shak|pale|terrif|frighten|afraid|panic|whimper|flinch|recoil|hands trembling)/i],
  ["surprised", /\b(gasp|startl|eyes widen|wide-eyed|taken aback|stunned|shocked|freez|stiffen)/i],
  ["sad", /\b(sigh|tear|cry|cries|sob|weep|mourn|grief|griev|heartbroken|sorrow|lowers? (her|his|their) (eyes|gaze|head)|looks? away|voice cracks)/i],
  ["smug", /\b(smirk|smil|chuckl|laugh|grin|scoff|amused|raises? an eyebrow|condescend|leans back|shrug)/i],
  ["nervous", /\b(fidget|shifts|shifting|swallow|sweat|stammer|stutter|nervous|hesitat|wring|bites? (her|his|their) lip|avoid|glanc|clears? (her|his|their) throat|tug|voice tight|rattled|uneasy)/i],
  ["calm", /\b(calm|composed|steady|evenly|relaxed|serene|coolly|measured)/i],
];

/** What a suspect looks like with nothing said yet, from their nerves alone. */
export function baselineExpression(stress: number): Expression {
  if (stress < 30) return "calm";
  if (stress < 55) return "neutral";
  if (stress < 78) return "nervous";
  return "scared";
}

export function expressionFromReply(reply: string, opts: { stress?: number; confession?: boolean; deflected?: boolean } = {}): Expression {
  if (opts.confession) return "broken";
  const directions = (reply.match(/\*[^*]+\*/g) ?? []).join(" ");
  for (const source of [directions, reply]) {
    if (!source) continue;
    for (const [expr, re] of CUES) {
      if (expr === "broken" && source !== directions && !opts.confession) continue;
      if (re.test(source)) {
        if (expr === "calm" && (opts.stress ?? 0) >= 70) return "nervous";
        return expr;
      }
    }
    // Stammering ("I- I was") and trailing off read as nerves.
    if (/\b(\w{1,3})-\s?\1/i.test(source) || /\.\.\.\s*\S/.test(source)) return "nervous";
  }
  if (opts.deflected) return "smug";
  return baselineExpression(opts.stress ?? 40);
}

/** A suspect's face for a given exchange (or right now, if it's their latest). */
export function expressionFor(m: UiMessage | undefined, suspect: PublicSuspect): Expression {
  if (suspect.confessed && (!m || m.confession)) return "broken";
  if (!m) return baselineExpression(suspect.stress);
  if (m.status === "pending" || m.status === "streaming") return m.kind === "present" ? "surprised" : "thinking";
  if (m.status === "failed") return baselineExpression(suspect.stress);
  return expressionFromReply(m.reply, { stress: suspect.stress, confession: m.confession, deflected: m.deflected });
}
