import type { Phase } from "@mystery/shared";
import { assign, initialTransition, setup, transition } from "xstate";

/**
 * The game's phase machine:
 *   lobby -> generating -> briefing -> interrogation x N -> discussion -> voting -> reveal
 *
 * It is used as a pure transition function: the persisted state lives in
 * Redis with the rest of the room, so any server instance can advance a room.
 * Timers and side effects (clue unlocks, budgets) live in the engine and react
 * to the phase the machine settles on.
 */

export type PhaseEvent =
  | { type: "START" }
  | { type: "CASE_READY" }
  | { type: "CASE_FAILED" }
  | { type: "ADVANCE" }
  | { type: "RESTART" };

export interface PhaseContext {
  round: number;
  totalRounds: number;
}

export const phaseMachine = setup({
  types: {
    context: {} as PhaseContext,
    events: {} as PhaseEvent,
    input: {} as { totalRounds: number },
  },
  guards: {
    hasMoreRounds: ({ context }) => context.round < context.totalRounds,
  },
  actions: {
    resetRound: assign({ round: 0 }),
    nextRound: assign({ round: ({ context }) => context.round + 1 }),
  },
}).createMachine({
  id: "phase",
  initial: "lobby",
  context: ({ input }) => ({ round: 0, totalRounds: input.totalRounds }),
  states: {
    lobby: {
      entry: "resetRound",
      on: { START: "generating" },
    },
    generating: {
      on: { CASE_READY: "briefing", CASE_FAILED: "lobby" },
    },
    briefing: {
      on: { ADVANCE: { target: "interrogation", actions: "nextRound" } },
    },
    interrogation: {
      on: {
        ADVANCE: [
          { guard: "hasMoreRounds", target: "interrogation", reenter: true, actions: "nextRound" },
          { target: "discussion" },
        ],
      },
    },
    discussion: { on: { ADVANCE: "voting" } },
    voting: { on: { ADVANCE: "reveal" } },
    reveal: { on: { RESTART: "lobby" } },
  },
});

/** What is stored in Redis for the machine. */
export interface PhaseState {
  value: Phase;
  context: PhaseContext;
}

export function initialPhaseState(totalRounds: number): PhaseState {
  const [snapshot] = initialTransition(phaseMachine, { totalRounds });
  return { value: snapshot.value as Phase, context: snapshot.context };
}

/** Apply an event. Returns the next state and whether anything changed. */
export function nextPhaseState(state: PhaseState, event: PhaseEvent): { state: PhaseState; changed: boolean } {
  const current = phaseMachine.resolveState({ value: state.value, context: state.context });
  if (!current.can(event)) return { state, changed: false };
  const [next] = transition(phaseMachine, current, event);
  const nextState = { value: next.value as Phase, context: next.context };
  // Re-entering "interrogation" counts as a change (a new round).
  return { state: nextState, changed: true };
}
