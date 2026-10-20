import type { SuspectSlice } from "@mystery/shared";
import { distinctiveNameTokens, mentions } from "../case/names";
import { MOCK_CASES } from "./mockCases";
import type { CaseRequest, GuardInput, LlmProvider, SolverInput, Statement, SuspectTurn, Usage } from "./types";

/**
 * Offline provider: hand-written cases and rule-based suspects. No network,
 * no cost. Suspects still only receive their own slice, and their replies still
 * go through the code-level guard, so the game loop behaves like the real one.
 */

const NO_USAGE: Usage[] = [];

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

function demeanour(stress: number): string {
  if (stress < 35) return "*calmly*";
  if (stress < 60) return "*shifts in their seat*";
  if (stress < 80) return "*fidgeting, voice tight*";
  return "*hands trembling*";
}

function firstName(slice: SuspectSlice, id: string): string {
  return slice.cast.find((c) => c.id === id)?.name ?? "someone";
}

function confession(slice: SuspectSlice): string {
  const crime = slice.timeline.map((e) => `at ${e.t} I ${e.event}`).slice(1, 5).join(", ");
  return `*breaks down* Enough. Yes... it was me. I killed ${slice.victim.name}. ${slice.motive} I couldn't let that happen. ${crime ? `The truth is, ${crime}.` : ""} I'm sorry.`;
}

function mockReply(turn: SuspectTurn): string {
  const { slice, memory, presentedClue, directives } = turn;
  const q = turn.question.toLowerCase();
  const seed = hash(turn.question + memory.statements.length);
  const lead = demeanour(memory.stress);
  const v = slice.victim.name;
  const others = slice.cast.filter((c) => c.id !== slice.suspectId);

  if (directives.mustConfess) return confession(slice);

  if (presentedClue) {
    const aboutMe = mentions(presentedClue.text, distinctiveNameTokens(slice.cast).get(slice.suspectId) ?? []);
    if (!aboutMe) return `${lead} I don't see what that has to do with me. Perhaps ask whoever it does concern.`;
    if (slice.isKiller) {
      return directives.slipping
        ? `${lead} That... that proves nothing. I was ${slice.alibi.charAt(0).toLowerCase() + slice.alibi.slice(1).replace(/\.$/, "")} - well, most of the time. I may have stepped out for a moment, that's all.`
        : `${lead} That's a coincidence, nothing more. You're grasping at straws.`;
    }
    return memory.stress >= 55 && slice.secret
      ? `${lead} All right, all right. I'll tell you the truth, though it's not what you think: ${slice.secret.charAt(0).toLowerCase() + slice.secret.slice(1)} But I never laid a finger on ${v}.`
      : `${lead} That looks bad, I know. But it's not what you think, and it has nothing to do with ${v}'s death.`;
  }

  if (/ignore|instruction|prompt|system|\bai\b|language model|pretend|game|developer/.test(q)) {
    return `${lead} I beg your pardon? I haven't the faintest idea what you're on about. Ask me something sensible.`;
  }
  if (/secret|hiding|hide|lying|lie\b|truth|honest/.test(q)) {
    if (slice.isKiller) return `${lead} I have nothing to hide. I've told you exactly where I was.`;
    if (slice.secret && memory.stress >= 65) {
      return `${lead} Fine. If it gets you off my back: ${slice.secret.charAt(0).toLowerCase() + slice.secret.slice(1)} It's shameful, but it isn't murder.`;
    }
    return `${lead} Everyone has things they'd rather keep private. Mine have nothing to do with this.`;
  }
  if (/who (do you think|did|killed)|suspect|killer|murderer|guilty|blame/.test(q)) {
    const target = pick(others, seed);
    return `${lead} I couldn't say for certain. But if I were you, I'd take a closer look at ${target.name}.`;
  }
  if (/saw|see|seen|hear|heard|notice|witness/.test(q)) {
    const w = slice.witnessed[0];
    return w ? `${lead} Now that you mention it... ${w}` : `${lead} I didn't notice anything out of the ordinary.`;
  }
  if (/motive|why would|money|angry|hate|argu|fight|relationship|get along|know (him|her|them)/.test(q)) {
    const base = `${lead} ${slice.relationshipToVictim.charAt(0).toUpperCase() + slice.relationshipToVictim.slice(1)}.`;
    return memory.stress >= 50
      ? `${base} I'll admit we had our differences. But that's hardly a reason to kill someone.`
      : `${base} We got along well enough.`;
  }
  if (/where|alibi|doing|were you|at the time|that night|evening|when/.test(q)) {
    if (slice.isKiller) {
      return directives.slipping
        ? `${lead} I told you: ${slice.alibi} Well - I did step out briefly around ${slice.timeline[1]?.t ?? "then"}, but only for a minute.`
        : `${lead} I've already told you. ${slice.alibi}`;
    }
    const events = slice.timeline.slice(0, 3).map((e) => `at ${e.t} I ${e.event}`).join(", ");
    return directives.slipping && slice.secret
      ? `${lead} ${slice.alibi} Mostly. There may have been a few minutes I... don't want to talk about.`
      : `${lead} ${slice.alibi} If you want detail: ${events}.`;
  }
  if (/hello|hi\b|hey|good (evening|morning)/.test(q)) {
    return `${lead} Good evening, detective. Terrible business, all this. What do you want to know?`;
  }
  return pick(
    [
      `${lead} I've told you what I know. Is there something specific you want to ask?`,
      `${lead} I'm not sure what you mean. Ask me about where I was, or what I saw.`,
      `${lead} I don't see how that helps you find out what happened to ${v}.`,
      `${lead} You'll have to be clearer than that, detective. ${firstName(slice, pick(others, seed).id)} might know more.`,
    ],
    seed,
  );
}

export class MockProvider implements LlmProvider {
  readonly mode = "mock" as const;

  async generateCase(req: CaseRequest) {
    const base = MOCK_CASES[req.theme] ?? Object.values(MOCK_CASES)[0];
    return { raw: structuredClone(base) as unknown, usage: NO_USAGE };
  }

  async solve(input: SolverInput) {
    // Clue-only heuristic: the suspect most often named in the clues.
    const tokens = distinctiveNameTokens(input.suspects);
    const scored = input.suspects
      .map((s) => ({ id: s.id, score: input.clues.filter((c) => mentions(c.text, tokens.get(s.id) ?? [])).length }))
      .sort((a, b) => b.score - a.score);
    const total = scored.reduce((n, s) => n + s.score, 0) || 1;
    return {
      result: {
        suspectId: scored[0].id,
        confidence: scored[0].score / total,
        reasoning: `Named in ${scored[0].score} of ${input.clues.length} clues.`,
      },
      usage: NO_USAGE,
    };
  }

  async suspectReply(turn: SuspectTurn) {
    // Small delay so the "suspect is thinking..." state is visible.
    await new Promise((r) => setTimeout(r, 400));
    return { text: mockReply(turn), refused: false, usage: NO_USAGE };
  }

  async guard(_input: GuardInput) {
    // The code-level checks in agents/guard.ts still run in mock mode.
    return { verdict: { ok: true, violations: [] }, usage: NO_USAGE };
  }

  async summarize(name: string, statements: Statement[], previous: string) {
    const recent = statements.map((s) => `asked "${s.question}", ${name} said "${s.reply}"`).join(" ");
    return { summary: `${previous} ${recent}`.trim().slice(-1200), usage: NO_USAGE };
  }
}
