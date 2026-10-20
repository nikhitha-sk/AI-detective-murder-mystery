import type { TimelineEvent } from "./case";

/** Views of game state that are safe to send to players. */

export const PHASES = [
  "lobby",
  "generating",
  "briefing",
  "interrogation",
  "discussion",
  "voting",
  "reveal",
] as const;
export type Phase = (typeof PHASES)[number];

export type Visibility = "public" | "private";

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  hasVoted: boolean;
  questionsLeft: number;
}

export interface PublicSuspect {
  id: string;
  name: string;
  role: string;
  relationshipToVictim: string;
  bio: string;
  /** 0-100, visible to players as a "nerves" meter. */
  stress: number;
  confessed: boolean;
}

export interface PublicCase {
  title: string;
  theme: string;
  setting: string;
  victim: {
    name: string;
    description: string;
    cause: string;
    timeOfDeath: string;
    foundBy: string;
    scene: string;
  };
  suspects: PublicSuspect[];
}

export interface PublicClue {
  id: string;
  round: number;
  text: string;
}

export interface ChatMessage {
  id: string;
  suspectId: string;
  askerId: string;
  askerName: string;
  visibility: Visibility;
  kind: "question" | "present";
  question: string;
  clueId: string | null;
  reply: string;
  round: number;
  ts: number;
  /** True when the guard replaced the draft with an in-character deflection. */
  deflected: boolean;
  /** True when this reply is the killer's confession (a game event). */
  confession: boolean;
}

export interface GenerationStatus {
  status: "idle" | "running" | "failed" | "ready";
  attempt: number;
  maxAttempts: number;
  message: string;
}

export interface RoomView {
  code: string;
  hostId: string;
  theme: string;
  solo: boolean;
  phase: Phase;
  round: number;
  totalRounds: number;
  phaseEndsAt: number | null;
  players: PublicPlayer[];
  case: PublicCase | null;
  clues: PublicClue[];
  questionsPerRound: number;
  tokenUsed: number;
  tokenBudget: number;
  generation: GenerationStatus;
  llmMode: "groq" | "anthropic" | "mock";
}

export interface NoteItem {
  id: string;
  kind: "suspect" | "clue" | "note";
  refId: string | null;
  text: string;
  x: number;
  y: number;
  color: string;
  authorId: string;
}

export interface PlayerScore {
  playerId: string;
  name: string;
  votedFor: string | null;
  correct: boolean;
  keyCluesPresented: number;
  questionsToKiller: number;
  score: number;
}

export interface RevealPayload {
  killerId: string;
  killerName: string;
  summary: string;
  timeline: TimelineEvent[];
  clues: (PublicClue & { pointsTo: string | null; isKey: boolean; contradicts: string | null })[];
  suspects: {
    id: string;
    name: string;
    motive: string;
    alibi: string;
    secret: string | null;
    timeline: TimelineEvent[];
  }[];
  votes: Record<string, string>;
  scores: PlayerScore[];
  playersWon: boolean;
  stats: { tokens: number; costUsd: number; durationSec: number };
}
