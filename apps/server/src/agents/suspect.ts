import type { LlmProvider, Statement, SuspectTurn, Usage } from "../llm/types";
import { deflection, reviewDraft, scriptedConfession } from "./guard";

export interface TurnResult {
  text: string;
  /** The guard rejected both drafts and an in-character deflection was sent instead. */
  deflected: boolean;
  usage: Usage[];
}

/**
 * Steps 4-5 of an interrogation turn: the suspect drafts a reply, the guard
 * checks it, and on failure the suspect gets one retry with the guard's
 * feedback before falling back to a deflection.
 */
export async function runSuspectTurn(llm: LlmProvider, turn: SuspectTurn): Promise<TurnResult> {
  const usage: Usage[] = [];
  const priorStatements: Statement[] = turn.memory.statements;
  const confessionAllowed = turn.directives.mustConfess;
  let attempt: SuspectTurn = turn;

  for (let i = 0; i < 2; i++) {
    try {
      const draft = await llm.suspectReply(attempt);
      usage.push(...draft.usage);
      if (draft.refused) {
        attempt = { ...turn, guardFeedback: "The reply was declined. Answer the question in character, briefly and PG-13." };
        continue;
      }
      const { verdict, usage: guardUsage } = await reviewDraft(llm, {
        slice: turn.slice,
        priorStatements,
        question: turn.question,
        draft: draft.text,
        confessionAllowed,
        mustConfess: turn.directives.mustConfess,
      });
      usage.push(...guardUsage);
      if (verdict.ok) return { text: draft.text, deflected: false, usage };
      attempt = { ...turn, guardFeedback: verdict.violations.map((v) => v.detail).join(" ") };
    } catch (err) {
      console.error(`[suspect ${turn.slice.suspectId}] reply failed:`, err instanceof Error ? err.message : err);
      break;
    }
  }

  // The confession is a game event decided by the server, so it happens even
  // if the model could not word it acceptably.
  if (turn.directives.mustConfess) return { text: scriptedConfession(turn.slice), deflected: false, usage };
  return { text: deflection(turn.slice, turn.memory.statements.length), deflected: true, usage };
}
