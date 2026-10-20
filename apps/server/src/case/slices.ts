import type { CaseFile, PublicCase, PublicClue, Suspect, SuspectSlice } from "@mystery/shared";
import type { SolverInput } from "../llm/types";

/**
 * Per-suspect knowledge slices. A slice contains the suspect's own persona,
 * timeline, alibi, secret and witness memories, plus public scene facts.
 * It never contains: the killer's identity (unless this suspect is the killer),
 * other suspects' secrets, motives or timelines, or any clue.
 */
export function buildSlice(c: CaseFile, s: Suspect): SuspectSlice {
  return {
    suspectId: s.id,
    name: s.name,
    role: s.role,
    relationshipToVictim: s.relationshipToVictim,
    persona: s.persona,
    motive: s.motive,
    alibi: s.alibi,
    secret: s.id === c.killerId ? null : s.secret,
    timeline: s.timeline.map((e) => ({ ...e })),
    witnessed: [...s.witnessed],
    isKiller: s.id === c.killerId,
    setting: c.setting,
    victim: {
      name: c.victim.name,
      description: c.victim.description,
      cause: c.victim.cause,
      foundBy: c.victim.foundBy,
      scene: c.victim.scene,
    },
    cast: c.suspects.map((o) => ({ id: o.id, name: o.name, role: o.role })),
  };
}

export function buildSlices(c: CaseFile): SuspectSlice[] {
  return c.suspects.map((s) => buildSlice(c, s));
}

/** Briefing view shared with every player. */
export function publicCase(c: CaseFile, stress: Record<string, number> = {}, confessed: string | null = null): PublicCase {
  return {
    title: c.title,
    theme: c.theme,
    setting: c.setting,
    victim: { ...c.victim },
    suspects: c.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      relationshipToVictim: s.relationshipToVictim,
      bio: s.bio,
      stress: stress[s.id] ?? 0,
      confessed: confessed === s.id,
    })),
  };
}

export function publicClue(c: CaseFile["clues"][number]): PublicClue {
  return { id: c.id, round: c.round, text: c.text };
}

/** What the independent solver sees: public facts, claimed alibis and clue text only. */
export function solverInput(c: CaseFile): SolverInput {
  return {
    setting: c.setting,
    victim: { name: c.victim.name, cause: c.victim.cause, timeOfDeath: c.victim.timeOfDeath, scene: c.victim.scene },
    suspects: c.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      relationshipToVictim: s.relationshipToVictim,
      bio: s.bio,
      alibi: s.alibi,
    })),
    clues: c.clues.map((cl) => ({ id: cl.id, text: cl.text })),
  };
}
