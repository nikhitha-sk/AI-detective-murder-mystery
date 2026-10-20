import { CaseFileSchema } from "@mystery/shared";
import { describe, expect, it } from "vitest";
import { suspectSystemPrompt } from "../src/agents/prompts";
import { generateCase } from "../src/case/generator";
import { checkCaseRules } from "../src/case/rules";
import { buildSlices, solverInput } from "../src/case/slices";
import { MockProvider } from "../src/llm/mock";
import { MOCK_CASES } from "../src/llm/mockCases";

const cases = Object.entries(MOCK_CASES);

describe("case rule checks", () => {
  it.each(cases)("%s passes schema and rules", (_theme, c) => {
    expect(CaseFileSchema.safeParse(c).success).toBe(true);
    expect(checkCaseRules(c, { rounds: 3 })).toEqual([]);
  });

  it("rejects a broken case with specific reasons", () => {
    const c = structuredClone(MOCK_CASES["manor-1920s"]);
    c.killerId = "s9";
    c.suspects[0].secret = null;
    c.suspects[1].timeline.reverse();
    c.clues = c.clues.slice(0, 3);
    const errors = checkCaseRules(c, { rounds: 3 });
    expect(errors.join("\n")).toMatch(/killerId "s9"/);
    expect(errors.join("\n")).toMatch(/needs a red-herring secret/);
    expect(errors.join("\n")).toMatch(/not in time order/);
    expect(errors.join("\n")).toMatch(/Need 6 to 10 clues/);
  });

  it("accepts timelines that run past midnight", () => {
    const c = structuredClone(MOCK_CASES["startup-office"]);
    c.suspects[0].timeline.push({ t: "00:30", event: "went home" });
    expect(checkCaseRules(c, { rounds: 3 })).toEqual([]);
  });
});

describe("solver and generator", () => {
  it.each(cases)("the solver names the killer of %s from the clues", async (_theme, c) => {
    const { result } = await new MockProvider().solve(solverInput(c));
    expect(result.suspectId).toBe(c.killerId);
  });

  it("the solver input contains no ground truth beyond clue text", () => {
    const input = JSON.stringify(solverInput(MOCK_CASES["college-fest"]));
    for (const key of ["killerId", "pointsTo", "isKey", "secret", "motive", "timeline", "solution"]) {
      expect(input).not.toContain(`"${key}":`);
    }
  });

  it("regenerates when the solver fails, up to the attempt limit", async () => {
    const llm = new MockProvider();
    let calls = 0;
    llm.solve = async () => {
      calls++;
      return { result: { suspectId: "s1", confidence: 1, reasoning: "wrong" }, usage: [] };
    };
    await expect(generateCase(llm, "manor-1920s", { rounds: 3, maxAttempts: 3 })).rejects.toThrow(/after 3 attempts/);
    expect(calls).toBe(3);
  });
});

describe("context isolation", () => {
  it.each(cases)("no suspect slice in %s knows anything it shouldn't", (_theme, c) => {
    const killer = c.suspects.find((s) => s.id === c.killerId)!;
    for (const slice of buildSlices(c)) {
      const text = JSON.stringify(slice) + suspectSystemPrompt(slice);
      expect(slice.isKiller).toBe(slice.suspectId === c.killerId);
      // Never: clues, the killer's identity, other suspects' secrets, motives or timelines.
      for (const clue of c.clues) expect(text).not.toContain(clue.text);
      expect(text).not.toContain(c.solution.summary);
      for (const other of c.suspects.filter((s) => s.id !== slice.suspectId)) {
        if (other.secret) expect(text).not.toContain(other.secret);
        expect(text).not.toContain(other.motive);
        for (const e of other.timeline) {
          if (!slice.timeline.some((mine) => mine.event === e.event)) expect(text).not.toContain(e.event);
        }
      }
      if (!slice.isKiller) {
        expect(text).not.toContain(killer.motive);
        expect(text).not.toMatch(/you killed/i);
      }
    }
  });
});
