import type { CaseFile, ChatMessage, Clue, PlayerScore, SuspectSlice } from "@mystery/shared";
import type { PlayerState } from "./state";

/**
 * Game rules that must not depend on a model's judgement: stress, when a
 * confession is allowed, and scoring.
 */

export const BASE_STRESS = { killer: 35, innocent: 20 };
export const SLIP_STRESS = 65;
const INNOCENT_MAX_STRESS = 90;

const PRESSURE = /\b(lie|lying|liar|killed|murder|guilty|confess|prove|admit|evidence|caught|truth)\b/i;

/** How much a turn raises a suspect's stress. */
export function stressDelta(slice: SuspectSlice, clue: Clue | null, question: string): number {
  if (clue) {
    if (clue.pointsTo !== slice.suspectId) return 3;
    if (slice.isKiller) return clue.isKey ? 25 : 15;
    return 15;
  }
  return 2 + (PRESSURE.test(question) ? 3 : 0);
}

export function applyStress(slice: SuspectSlice, current: number, delta: number): number {
  const cap = slice.isKiller ? 100 : INNOCENT_MAX_STRESS;
  return Math.max(0, Math.min(cap, current + delta));
}

/**
 * A confession is a game event, not something the model decides: only the
 * killer, only above the stress threshold, and only once a key clue has been
 * put in front of them.
 */
export function confessionAllowed(opts: {
  slice: SuspectSlice;
  stress: number;
  evidenceSeen: string[];
  caseFile: CaseFile;
  threshold: number;
  alreadyConfessed: boolean;
}): boolean {
  if (!opts.slice.isKiller || opts.alreadyConfessed || opts.stress < opts.threshold) return false;
  return opts.caseFile.clues.some(
    (c) => c.isKey && c.pointsTo === opts.slice.suspectId && opts.evidenceSeen.includes(c.id),
  );
}

/** Plurality vote; a tie means the room did not settle on the killer. */
export function roomVerdict(votes: Record<string, string>): string | null {
  const tally = new Map<string, number>();
  for (const s of Object.values(votes)) tally.set(s, (tally.get(s) ?? 0) + 1);
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length || (sorted[1] && sorted[1][1] === sorted[0][1])) return null;
  return sorted[0][0];
}

/** "Who was closest": a correct vote, plus credit for pressing the killer with key evidence. */
export function scorePlayers(
  players: PlayerState[],
  votes: Record<string, string>,
  messages: ChatMessage[],
  caseFile: CaseFile,
): PlayerScore[] {
  const keyClues = new Set(caseFile.clues.filter((c) => c.isKey).map((c) => c.id));
  return players
    .map((p) => {
      const mine = messages.filter((m) => m.askerId === p.id && m.suspectId === caseFile.killerId);
      const keyCluesPresented = new Set(mine.filter((m) => m.clueId && keyClues.has(m.clueId)).map((m) => m.clueId)).size;
      const questionsToKiller = mine.length;
      const votedFor = votes[p.id] ?? null;
      const correct = votedFor === caseFile.killerId;
      return {
        playerId: p.id,
        name: p.name,
        votedFor,
        correct,
        keyCluesPresented,
        questionsToKiller,
        score: (correct ? 100 : 0) + keyCluesPresented * 15 + Math.min(questionsToKiller, 10) * 2,
      };
    })
    .sort((a, b) => b.score - a.score);
}
