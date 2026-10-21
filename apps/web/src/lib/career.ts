"use client";

import type { RevealPayload } from "@mystery/shared";
import type { UiMessage } from "@/store/game";

/**
 * The player's detective career: rank, XP and badges across games. Kept in
 * this browser only (a per-player convenience); the game itself never
 * depends on it.
 */

export interface Career {
  xp: number;
  cases: number;
  solved: number;
  streak: number;
  bestStreak: number;
  badges: Record<string, number>;
  /** Reveals already counted, so a refresh doesn't award XP twice. */
  counted: string[];
  /** The career just before the most recent case, so its results screen can be shown again. */
  last?: { key: string; before: Omit<Career, "counted" | "last"> };
}

export interface Rank {
  title: string;
  minXp: number;
  icon: string;
}

export const RANKS: Rank[] = [
  { title: "Rookie", minXp: 0, icon: "🔎" },
  { title: "Constable", minXp: 150, icon: "🎖️" },
  { title: "Detective", minXp: 400, icon: "🕵️" },
  { title: "Sergeant", minXp: 800, icon: "⭐" },
  { title: "Inspector", minXp: 1400, icon: "🏅" },
  { title: "Chief Inspector", minXp: 2200, icon: "🎩" },
  { title: "Legendary Sleuth", minXp: 3500, icon: "👑" },
];

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
}

export const BADGES: Record<string, Omit<Badge, "id">> = {
  "case-closed": { title: "Case Closed", description: "Named the killer", icon: "⚖️", xp: 0 },
  airtight: { title: "Airtight Case", description: "Picked the key evidence in your accusation", icon: "📁", xp: 40 },
  "alibi-breaker": { title: "Alibi Breaker", description: "Confronted the killer with evidence that broke their alibi", icon: "🧩", xp: 30 },
  confession: { title: "The Confession", description: "Your interrogation made the killer crack", icon: "💥", xp: 60 },
  "sharp-eye": { title: "Sharp Eye", description: "Solved it with 8 questions or fewer", icon: "👁️", xp: 35 },
  thorough: { title: "No Stone Unturned", description: "Questioned every suspect", icon: "🗂️", xp: 15 },
};

const KEY = "ai-detective:career";
const EMPTY: Career = { xp: 0, cases: 0, solved: 0, streak: 0, bestStreak: 0, badges: {}, counted: [] };

export function loadCareer(): Career {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return raw && typeof raw.xp === "number" ? { ...EMPTY, ...raw } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function saveCareer(c: Career) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Storage blocked: the career just won't persist.
  }
}

export function rankFor(xp: number): { rank: Rank; next: Rank | null; progress: number } {
  let i = RANKS.length - 1;
  while (i > 0 && xp < RANKS[i].minXp) i--;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  return { rank, next, progress: Math.max(0, Math.min(1, progress)) };
}

/** The exhibit a player named in their accusation, kept per game so the reveal can check it. */
const caseKey = (code: string, title: string) => `ai-detective:case:${code}:${title}`;

export function saveAccusationEvidence(code: string, title: string, clueId: string | null) {
  try {
    if (clueId) sessionStorage.setItem(caseKey(code, title), clueId);
    else sessionStorage.removeItem(caseKey(code, title));
  } catch {
    // Not remembered: the reveal simply won't grade the evidence.
  }
}

export function loadAccusationEvidence(code: string, title: string): string | null {
  try {
    return sessionStorage.getItem(caseKey(code, title));
  } catch {
    return null;
  }
}

export interface CaseReport {
  correct: boolean;
  baseScore: number;
  evidenceId: string | null;
  evidenceVerdict: "key" | "supporting" | "wrong" | null;
  badges: Badge[];
  xpGained: number;
}

/** Grade this player's game from the reveal and the exchanges they could see. */
export function gradeCase(opts: {
  reveal: RevealPayload;
  playerId: string;
  messages: UiMessage[];
  suspectIds: string[];
  evidenceId: string | null;
}): CaseReport {
  const { reveal, playerId, messages } = opts;
  const me = reveal.scores.find((s) => s.playerId === playerId);
  const correct = !!me?.correct;
  const mine = messages.filter((m) => m.askerId === playerId);
  const clue = reveal.clues.find((c) => c.id === opts.evidenceId);
  const evidenceVerdict = !clue ? null : clue.pointsTo === reveal.killerId ? (clue.isKey ? "key" : "supporting") : "wrong";

  const earned: string[] = [];
  if (correct) earned.push("case-closed");
  if (correct && evidenceVerdict === "key") earned.push("airtight");
  const alibiClues = new Set(reveal.clues.filter((c) => c.contradicts?.startsWith(`${reveal.killerId}.`)).map((c) => c.id));
  if (mine.some((m) => m.suspectId === reveal.killerId && m.clueId && alibiClues.has(m.clueId))) earned.push("alibi-breaker");
  if (mine.some((m) => m.confession)) earned.push("confession");
  if (correct && mine.length > 0 && mine.length <= 8) earned.push("sharp-eye");
  if (opts.suspectIds.every((id) => mine.some((m) => m.suspectId === id))) earned.push("thorough");

  const badges = earned.map((id) => ({ id, ...BADGES[id] }));
  const baseScore = me?.score ?? 0;
  const xpGained = baseScore + 20 + badges.reduce((n, b) => n + b.xp, 0);
  return { correct, baseScore, evidenceId: opts.evidenceId, evidenceVerdict, badges, xpGained };
}

/** Add a graded case to the career once. Returns the career before and after. */
export function recordCase(revealKey: string, report: CaseReport): { before: Career; after: Career; alreadyCounted: boolean } {
  const before = loadCareer();
  if (before.counted.includes(revealKey)) {
    // Shown again (refresh, remount): replay the same before/after instead of awarding twice.
    const prior = before.last?.key === revealKey ? { ...before, ...before.last.before } : before;
    return { before: prior, after: before, alreadyCounted: true };
  }
  const streak = report.correct ? before.streak + 1 : 0;
  const badges = { ...before.badges };
  for (const b of report.badges) badges[b.id] = (badges[b.id] ?? 0) + 1;
  const after: Career = {
    xp: before.xp + report.xpGained,
    cases: before.cases + 1,
    solved: before.solved + (report.correct ? 1 : 0),
    streak,
    bestStreak: Math.max(before.bestStreak, streak),
    badges,
    counted: [...before.counted, revealKey].slice(-50),
    last: {
      key: revealKey,
      before: { xp: before.xp, cases: before.cases, solved: before.solved, streak: before.streak, bestStreak: before.bestStreak, badges: before.badges },
    },
  };
  saveCareer(after);
  return { before, after, alreadyCounted: false };
}
