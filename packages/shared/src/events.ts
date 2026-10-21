import { z } from "zod";
import { ThemeInputSchema, type Theme, type ThemeInput } from "./themes";
import type {
  ChatMessage,
  NoteItem,
  Phase,
  PublicClue,
  PublicSuspect,
  RevealPayload,
  RoomView,
  Visibility,
} from "./views";

/**
 * Socket.IO contract. Every client payload is untrusted and parsed with the
 * schemas below before the server acts on it.
 */

export const MAX_QUESTION_CHARS = 300;
export const MAX_NAME_CHARS = 24;
export const MAX_NOTE_CHARS = 200;

const name = z.string().trim().min(1).max(MAX_NAME_CHARS);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Room codes are 6 letters or digits");

export const RoomCreateSchema = z.object({
  name,
  theme: ThemeInputSchema,
  solo: z.boolean().default(false),
});
export const RoomJoinSchema = z.object({ code, name });
export const SetThemeSchema = z.object({ theme: ThemeInputSchema });
/** Ask the AI for fresh settings, avoiding the ones the player already has. */
export const ThemesGenerateSchema = z.object({
  avoid: z.array(z.string().trim().max(40)).max(60).default([]),
});
export const AskSchema = z.object({
  suspectId: z.string().min(1).max(8),
  text: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
  private: z.boolean().default(false),
});
export const PresentSchema = z.object({
  suspectId: z.string().min(1).max(8),
  clueId: z.string().min(1).max(8),
  text: z.string().trim().max(MAX_QUESTION_CHARS).optional(),
  private: z.boolean().default(false),
});
export const VoteSchema = z.object({ suspectId: z.string().min(1).max(8) });
export const NoteAddSchema = z.object({
  kind: z.enum(["suspect", "clue", "note"]),
  refId: z.string().max(8).nullable().default(null),
  text: z.string().trim().max(MAX_NOTE_CHARS).default(""),
  x: z.number().finite().min(0).max(4000),
  y: z.number().finite().min(0).max(4000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#fde68a"),
});
export const NoteMoveSchema = z.object({
  id: z.string().min(1).max(32),
  x: z.number().finite().min(0).max(4000),
  y: z.number().finite().min(0).max(4000),
});
export const NoteRemoveSchema = z.object({ id: z.string().min(1).max(32) });

export type RoomCreateInput = z.input<typeof RoomCreateSchema>;
export type RoomJoinInput = z.input<typeof RoomJoinSchema>;
export type AskInput = z.input<typeof AskSchema>;
export type PresentInput = z.input<typeof PresentSchema>;
export type NoteAddInput = z.input<typeof NoteAddSchema>;

export type Ack<T = void> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface ReplyPending {
  messageId: string;
  suspectId: string;
  askerId: string;
  askerName: string;
  visibility: Visibility;
  kind: "question" | "present";
  question: string;
  clueId: string | null;
  round: number;
}

export interface ClientToServerEvents {
  "room:create": (input: RoomCreateInput, ack: Ack<{ code: string }>) => void;
  "room:join": (input: RoomJoinInput, ack: Ack<{ code: string }>) => void;
  "room:leave": () => void;
  "room:setTheme": (input: { theme: ThemeInput }, ack?: Ack) => void;
  "themes:generate": (input: { avoid: string[] }, ack: Ack<Theme[]>) => void;
  "game:start": (ack?: Ack) => void;
  "game:advance": (ack?: Ack) => void;
  "game:restart": (ack?: Ack) => void;
  ask: (input: AskInput, ack?: Ack<{ messageId: string }>) => void;
  present: (input: PresentInput, ack?: Ack<{ messageId: string }>) => void;
  vote: (input: { suspectId: string }, ack?: Ack) => void;
  "notes:add": (input: NoteAddInput, ack?: Ack) => void;
  "notes:move": (input: { id: string; x: number; y: number }) => void;
  "notes:remove": (input: { id: string }) => void;
}

export interface ServerToClientEvents {
  "room:state": (state: RoomView) => void;
  "phase:changed": (p: { phase: Phase; round: number; phaseEndsAt: number | null }) => void;
  "messages:sync": (messages: ChatMessage[]) => void;
  "reply:pending": (p: ReplyPending) => void;
  "reply:chunk": (p: { messageId: string; delta: string }) => void;
  "reply:done": (message: ChatMessage) => void;
  "reply:failed": (p: { messageId: string; error: string }) => void;
  "clue:unlocked": (clues: PublicClue[]) => void;
  "suspect:update": (suspect: PublicSuspect) => void;
  "budget:update": (p: { questionsLeft: number; tokenUsed: number; tokenBudget: number }) => void;
  "notes:sync": (notes: NoteItem[]) => void;
  reveal: (payload: RevealPayload) => void;
  "server:error": (p: { message: string }) => void;
}

export interface SocketData {
  playerId: string;
  code: string | null;
}
