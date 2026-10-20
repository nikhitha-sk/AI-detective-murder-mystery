import type { GenerationStatus } from "@mystery/shared";
import type { Statement } from "../llm/types";
import type { PhaseState } from "./machine";

export interface PlayerState {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: number;
}

/** Redis: room:{code}. Everything the game server needs to run a room. */
export interface RoomState {
  code: string;
  hostId: string;
  theme: string;
  solo: boolean;
  createdAt: number;
  players: PlayerState[];
  machine: PhaseState;
  phaseEndsAt: number | null;
  caseId: string | null;
  gameId: string | null;
  gameStartedAt: number | null;
  /** Questions used by each player in the current round. */
  questionsUsed: Record<string, number>;
  unlockedClueIds: string[];
  votes: Record<string, string>;
  confessedId: string | null;
  generation: GenerationStatus;
}

/** Redis: suspect:{code}:{id}. A suspect's private memory. */
export interface SuspectMemory {
  stress: number;
  statements: Statement[];
  evidenceSeen: string[];
  /** Summary of statements that were compacted out of `statements`. */
  summary: string;
}

export const keys = {
  room: (code: string) => `room:${code}`,
  case: (code: string) => `case:${code}`,
  slice: (code: string, id: string) => `slice:${code}:${id}`,
  suspect: (code: string, id: string) => `suspect:${code}:${id}`,
  messages: (code: string) => `msgs:${code}`,
  notes: (code: string) => `notes:${code}`,
  reveal: (code: string) => `reveal:${code}`,
  tokens: (code: string) => `tokens:${code}`,
  costMicros: (code: string) => `cost:${code}`,
  rateLimit: (code: string, playerId: string) => `rl:${code}:${playerId}`,
  activeRooms: "rooms:active",
  roomLock: (code: string) => `lock:room:${code}`,
  suspectLock: (code: string, id: string) => `lock:suspect:${code}:${id}`,
  notesLock: (code: string) => `lock:notes:${code}`,
};

export const idleGeneration = (maxAttempts: number): GenerationStatus => ({
  status: "idle",
  attempt: 0,
  maxAttempts,
  message: "",
});
