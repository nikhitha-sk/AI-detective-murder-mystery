import { describe, expect, it } from "vitest";
import { initialPhaseState, nextPhaseState, type PhaseEvent, type PhaseState } from "../src/game/machine";

function run(state: PhaseState, ...events: PhaseEvent["type"][]) {
  for (const type of events) state = nextPhaseState(state, { type } as PhaseEvent).state;
  return state;
}

describe("phase machine", () => {
  it("walks through a full game with three rounds", () => {
    let s = initialPhaseState(3);
    expect(s.value).toBe("lobby");
    s = run(s, "START", "CASE_READY");
    expect(s.value).toBe("briefing");
    s = run(s, "ADVANCE");
    expect(s).toMatchObject({ value: "interrogation", context: { round: 1 } });
    s = run(s, "ADVANCE", "ADVANCE");
    expect(s).toMatchObject({ value: "interrogation", context: { round: 3 } });
    s = run(s, "ADVANCE");
    expect(s.value).toBe("discussion");
    s = run(s, "ADVANCE", "ADVANCE");
    expect(s.value).toBe("reveal");
    s = run(s, "RESTART");
    expect(s).toMatchObject({ value: "lobby", context: { round: 0 } });
  });

  it("ignores events that are not valid in the current phase", () => {
    const s = initialPhaseState(3);
    expect(nextPhaseState(s, { type: "ADVANCE" }).changed).toBe(false);
    expect(nextPhaseState(s, { type: "CASE_READY" }).changed).toBe(false);
  });

  it("returns to the lobby when case generation fails", () => {
    expect(run(initialPhaseState(3), "START", "CASE_FAILED").value).toBe("lobby");
  });

  it("survives a JSON round trip (as stored in Redis)", () => {
    const s = run(initialPhaseState(2), "START", "CASE_READY", "ADVANCE");
    const restored = JSON.parse(JSON.stringify(s)) as PhaseState;
    expect(run(restored, "ADVANCE")).toMatchObject({ value: "interrogation", context: { round: 2 } });
    expect(run(restored, "ADVANCE", "ADVANCE").value).toBe("discussion");
  });
});
