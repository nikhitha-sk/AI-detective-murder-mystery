import type { CaseFile } from "@mystery/shared";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes since 06:00, so an evening that runs past midnight still sorts. */
export function eveningMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  const minutes = h * 60 + m;
  return minutes < 6 * 60 ? minutes + 24 * 60 : minutes;
}

/**
 * Rule checks run on every generated case before the solver sees it.
 * Returns a list of human-readable problems (empty = passes). The same strings
 * are fed back to the generator on a retry.
 */
export function checkCaseRules(c: CaseFile, opts: { rounds: number }): string[] {
  const errors: string[] = [];
  const ids = c.suspects.map((s) => s.id);
  const idSet = new Set(ids);

  if (c.suspects.length < 4 || c.suspects.length > 5) errors.push(`Need 4 or 5 suspects, got ${c.suspects.length}.`);
  if (idSet.size !== ids.length) errors.push("Suspect ids must be unique.");
  if (!idSet.has(c.killerId)) errors.push(`killerId "${c.killerId}" is not one of the suspects.`);

  // Exactly one killer is guaranteed by the single killerId; check the roles fit it.
  for (const s of c.suspects) {
    if (!s.name.trim()) errors.push(`Suspect ${s.id} has no name.`);
    if (s.timeline.length === 0) errors.push(`Suspect ${s.id} has an empty timeline.`);
    if (s.id === c.killerId) {
      if (s.secret) errors.push(`The killer (${s.id}) must have secret = null.`);
    } else if (!s.secret?.trim()) {
      errors.push(`Innocent suspect ${s.id} needs a red-herring secret.`);
    }
  }

  // Times and timelines.
  if (!TIME.test(c.victim.timeOfDeath)) errors.push(`victim.timeOfDeath "${c.victim.timeOfDeath}" is not HH:MM.`);
  const timelines: [string, { t: string }[]][] = [
    ...c.suspects.map((s): [string, { t: string }[]] => [`suspect ${s.id}`, s.timeline]),
    ["solution", c.solution.timeline],
  ];
  for (const [label, events] of timelines) {
    const bad = events.find((e) => !TIME.test(e.t));
    if (bad) {
      errors.push(`Timeline of ${label} has an invalid time "${bad.t}".`);
      continue;
    }
    for (let i = 1; i < events.length; i++) {
      if (eveningMinutes(events[i].t) < eveningMinutes(events[i - 1].t)) {
        errors.push(`Timeline of ${label} is not in time order (${events[i - 1].t} then ${events[i].t}).`);
        break;
      }
    }
  }
  if (c.solution.timeline.length === 0) errors.push("solution.timeline is empty.");

  const killer = c.suspects.find((s) => s.id === c.killerId);
  if (killer && TIME.test(c.victim.timeOfDeath) && killer.timeline.every((e) => TIME.test(e.t))) {
    const tod = eveningMinutes(c.victim.timeOfDeath);
    const near = killer.timeline.some((e) => Math.abs(eveningMinutes(e.t) - tod) <= 30);
    if (!near) errors.push("The killer's true timeline has no event within 30 minutes of the time of death.");
  }

  // Clues.
  const clueIds = c.clues.map((cl) => cl.id);
  if (new Set(clueIds).size !== clueIds.length) errors.push("Clue ids must be unique.");
  if (c.clues.length < 6 || c.clues.length > 10) errors.push(`Need 6 to 10 clues, got ${c.clues.length}.`);
  for (const cl of c.clues) {
    if (!Number.isInteger(cl.round) || cl.round < 1 || cl.round > opts.rounds) {
      errors.push(`Clue ${cl.id} has round ${cl.round}; rounds run 1 to ${opts.rounds}.`);
    }
    if (cl.pointsTo !== null && !idSet.has(cl.pointsTo)) errors.push(`Clue ${cl.id} points to unknown suspect "${cl.pointsTo}".`);
    if (cl.contradicts) {
      const target = cl.contradicts.split(".")[0];
      if (!idSet.has(target)) errors.push(`Clue ${cl.id} contradicts unknown suspect "${cl.contradicts}".`);
    }
    if (cl.isKey && cl.pointsTo !== c.killerId) errors.push(`Key clue ${cl.id} must point to the killer.`);
  }
  for (let r = 1; r <= opts.rounds; r++) {
    if (!c.clues.some((cl) => cl.round === r)) errors.push(`No clue unlocks in round ${r}.`);
  }

  const counts = new Map<string, number>();
  for (const cl of c.clues) if (cl.pointsTo) counts.set(cl.pointsTo, (counts.get(cl.pointsTo) ?? 0) + 1);
  const killerCount = counts.get(c.killerId) ?? 0;
  if (killerCount < 2) errors.push(`At least 2 clues must point to the killer, got ${killerCount}.`);
  if (!c.clues.some((cl) => cl.isKey && cl.pointsTo === c.killerId)) errors.push("At least one key clue must implicate the killer.");
  for (const [id, n] of counts) {
    if (id !== c.killerId && n >= killerCount) {
      errors.push(`Suspect ${id} is implicated by as many clues (${n}) as the killer (${killerCount}).`);
    }
  }

  return errors;
}
