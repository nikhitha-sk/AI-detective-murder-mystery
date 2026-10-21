import { randomInt, randomUUID } from "node:crypto";
import {
  themeById,
  type CaseFile,
  type ChatMessage,
  type Clue,
  type NoteAddInput,
  type NoteItem,
  type Phase,
  type PublicClue,
  type ReplyPending,
  type RevealPayload,
  type RoomView,
  type ServerToClientEvents,
  type SuspectSlice,
  type Theme,
  type Visibility,
} from "@mystery/shared";
import { runSuspectTurn } from "../agents/suspect";
import { CaseGenerationError, generateCase } from "../case/generator";
import { buildSlices, publicCase, publicClue } from "../case/slices";
import { generateThemes } from "../case/themes";
import type { GameRules } from "../config";
import type { Persistence } from "../db";
import { totalCost, totalTokens } from "../llm/pricing";
import type { LlmProvider, Statement, Usage } from "../llm/types";
import { withLock, type Store } from "../store";
import { initialPhaseState, nextPhaseState, type PhaseEvent } from "./machine";
import {
  BASE_STRESS,
  SLIP_STRESS,
  applyStress,
  confessionAllowed,
  roomVerdict,
  scorePlayers,
  stressDelta,
} from "./rules";
import { idleGeneration, keys, type RoomState, type SuspectMemory } from "./state";

const roomTheme = (room: RoomState): Theme => room.themeInfo ?? themeById(room.theme);

/** Errors whose message is safe to show to the player. */
export class GameError extends Error {}

type Emit = <E extends keyof ServerToClientEvents>(
  target: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) => void;

/** How the engine talks to clients. Socket.IO in production, a recorder in tests. */
export interface Broadcaster {
  /** Everyone in the room. */
  room: Emit;
  /** Every socket of one player. */
  player: Emit;
}

export interface EngineDeps {
  store: Store;
  llm: LlmProvider;
  db: Persistence;
  out: Broadcaster;
  rules: GameRules;
  /** Typewriter delay between chunks, ms. Set to 0 in tests. */
  typewriterMs?: number;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Keep the newest statements verbatim; older ones get summarised. */
const MEMORY_KEEP = 8;
const MEMORY_COMPACT_AT = 14;

export class GameEngine {
  private readonly store: Store;
  private readonly ttl: number;

  constructor(private deps: EngineDeps) {
    this.store = deps.store;
    this.ttl = deps.rules.roomTtlSeconds;
  }

  // -------------------------------------------------------------------------
  // Storage helpers
  // -------------------------------------------------------------------------

  private async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private setJson(key: string, value: unknown) {
    return this.store.set(key, JSON.stringify(value), this.ttl);
  }

  async getRoom(code: string): Promise<RoomState | null> {
    return this.getJson<RoomState>(keys.room(code));
  }

  private async requireRoom(code: string): Promise<RoomState> {
    const room = await this.getRoom(code);
    if (!room) throw new GameError("That room does not exist (or it has expired).");
    return room;
  }

  private getCase(code: string) {
    return this.getJson<CaseFile>(keys.case(code));
  }

  private getSlice(code: string, id: string) {
    return this.getJson<SuspectSlice>(keys.slice(code, id));
  }

  private getMemory(code: string, id: string) {
    return this.getJson<SuspectMemory>(keys.suspect(code, id));
  }

  private async getMessages(code: string): Promise<ChatMessage[]> {
    return (await this.store.lrange(keys.messages(code))).map((m) => JSON.parse(m) as ChatMessage);
  }

  private async getNotes(code: string): Promise<NoteItem[]> {
    return (await this.getJson<NoteItem[]>(keys.notes(code))) ?? [];
  }

  /**
   * Load, mutate and save a room under its lock. `fn` may return follow-up
   * work, which runs after the lock is released.
   */
  private async mutateRoom(
    code: string,
    fn: (room: RoomState) => void | (() => Promise<void>)[] | Promise<void | (() => Promise<void>)[]>,
  ): Promise<RoomState> {
    let after: (() => Promise<void>)[] = [];
    const room = await withLock(this.store, keys.roomLock(code), async () => {
      const room = await this.requireRoom(code);
      after = (await fn(room)) || [];
      await this.setJson(keys.room(code), room);
      return room;
    });
    for (const job of after) await job();
    return room;
  }

  private async recordUsage(code: string, usage: Usage[]) {
    const tokens = totalTokens(usage);
    if (tokens > 0) await this.store.incrBy(keys.tokens(code), tokens, this.ttl);
    const micros = Math.round(totalCost(usage) * 1_000_000);
    if (micros > 0) await this.store.incrBy(keys.costMicros(code), micros, this.ttl);
  }

  private async tokenUsage(code: string) {
    const [tokens, micros] = await Promise.all([
      this.store.get(keys.tokens(code)),
      this.store.get(keys.costMicros(code)),
    ]);
    return { tokens: Number(tokens ?? 0), costUsd: Number(micros ?? 0) / 1_000_000 };
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  async view(room: RoomState): Promise<RoomView> {
    const caseFile = room.caseId ? await this.getCase(room.code) : null;
    const stress: Record<string, number> = {};
    if (caseFile) {
      const memories = await Promise.all(caseFile.suspects.map((s) => this.getMemory(room.code, s.id)));
      caseFile.suspects.forEach((s, i) => (stress[s.id] = memories[i]?.stress ?? 0));
    }
    const { tokens } = await this.tokenUsage(room.code);
    const r = this.deps.rules;
    return {
      code: room.code,
      hostId: room.hostId,
      theme: room.theme,
      themeInfo: roomTheme(room),
      solo: room.solo,
      phase: room.machine.value,
      round: room.machine.context.round,
      totalRounds: room.machine.context.totalRounds,
      phaseEndsAt: room.phaseEndsAt,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.id === room.hostId,
        hasVoted: p.id in room.votes,
        questionsLeft: Math.max(0, r.questionsPerRound - (room.questionsUsed[p.id] ?? 0)),
      })),
      case: caseFile ? publicCase(caseFile, stress, room.confessedId) : null,
      clues: caseFile ? caseFile.clues.filter((c) => room.unlockedClueIds.includes(c.id)).map(publicClue) : [],
      questionsPerRound: r.questionsPerRound,
      tokenUsed: tokens,
      tokenBudget: r.roomTokenBudget,
      generation: room.generation,
      llmMode: this.deps.llm.mode,
    };
  }

  private async broadcastState(room: RoomState) {
    this.deps.out.room(room.code, "room:state", await this.view(room));
  }

  /** Full resync for one player: state, the messages they may see, notes, reveal. */
  async syncPlayer(code: string, playerId: string) {
    const room = await this.requireRoom(code);
    const out = this.deps.out;
    out.player(playerId, "room:state", await this.view(room));
    const visible = (await this.getMessages(code)).filter((m) => m.visibility === "public" || m.askerId === playerId);
    out.player(playerId, "messages:sync", visible);
    out.player(playerId, "notes:sync", await this.getNotes(code));
    if (room.machine.value === "reveal") {
      const reveal = await this.getJson<RevealPayload>(keys.reveal(code));
      if (reveal) out.player(playerId, "reveal", reveal);
    }
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  async createRoom(playerId: string, name: string, theme: Theme, solo: boolean): Promise<string> {
    let code = "";
    for (let i = 0; i < 20; i++) {
      code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
      if (!(await this.store.get(keys.room(code)))) break;
    }
    const now = Date.now();
    const room: RoomState = {
      code,
      hostId: playerId,
      theme: theme.id,
      themeInfo: theme,
      solo,
      createdAt: now,
      players: [{ id: playerId, name, connected: true, joinedAt: now }],
      machine: initialPhaseState(this.deps.rules.rounds),
      phaseEndsAt: null,
      caseId: null,
      gameId: null,
      gameStartedAt: null,
      questionsUsed: {},
      unlockedClueIds: [],
      votes: {},
      confessedId: null,
      generation: idleGeneration(this.deps.rules.maxCaseAttempts),
    };
    await this.setJson(keys.room(code), room);
    await this.store.sadd(keys.activeRooms, code);
    return code;
  }

  async joinRoom(playerId: string, name: string, code: string) {
    const room = await this.mutateRoom(code, (room) => {
      const existing = room.players.find((p) => p.id === playerId);
      if (existing) {
        existing.connected = true;
        existing.name = name;
        return;
      }
      if (room.solo) throw new GameError("This is a solo game. Create your own room to play.");
      if (room.players.length >= this.deps.rules.maxPlayers) throw new GameError("This room is full (6 players max).");
      room.players.push({ id: playerId, name, connected: true, joinedAt: Date.now() });
    });
    await this.broadcastState(room);
  }

  /** A player's last socket disconnected. They keep their seat so they can rejoin. */
  async disconnect(code: string, playerId: string) {
    const room = await this.getRoom(code);
    if (!room) return;
    const updated = await this.mutateRoom(code, (room) => {
      const p = room.players.find((p) => p.id === playerId);
      if (p) p.connected = false;
      this.reassignHost(room);
    });
    await this.broadcastState(updated);
  }

  async leave(code: string, playerId: string) {
    const room = await this.getRoom(code);
    if (!room) return;
    const updated = await this.mutateRoom(code, (room) => {
      room.players = room.players.filter((p) => p.id !== playerId);
      delete room.votes[playerId];
      this.reassignHost(room);
    });
    if (updated.players.length === 0) await this.deleteRoom(code);
    else await this.broadcastState(updated);
  }

  private reassignHost(room: RoomState) {
    const host = room.players.find((p) => p.id === room.hostId);
    if (host?.connected) return;
    const next = room.players.find((p) => p.connected);
    if (next) room.hostId = next.id;
  }

  private async deleteRoom(code: string) {
    const caseFile = await this.getCase(code);
    const suspectKeys = (caseFile?.suspects ?? []).flatMap((s) => [keys.slice(code, s.id), keys.suspect(code, s.id)]);
    await this.store.del(
      keys.room(code),
      keys.case(code),
      keys.messages(code),
      keys.notes(code),
      keys.reveal(code),
      keys.tokens(code),
      keys.costMicros(code),
      ...suspectKeys,
    );
    await this.store.srem(keys.activeRooms, code);
  }

  private assertHost(room: RoomState, playerId: string) {
    if (room.hostId !== playerId) throw new GameError("Only the host can do that.");
  }

  async setTheme(code: string, playerId: string, theme: Theme) {
    const room = await this.mutateRoom(code, (room) => {
      this.assertHost(room, playerId);
      if (room.machine.value !== "lobby") throw new GameError("The theme can only be changed in the lobby.");
      room.theme = theme.id;
      room.themeInfo = theme;
    });
    await this.broadcastState(room);
  }

  // -------------------------------------------------------------------------
  // Phases
  // -------------------------------------------------------------------------

  /** Apply a phase event to a locked room, then run that phase's entry effects. */
  private transition(room: RoomState, event: PhaseEvent, caseFile: CaseFile | null = null): (() => Promise<void>)[] {
    const { state, changed } = nextPhaseState(room.machine, event);
    if (!changed) return [];
    room.machine = state;
    return this.enterPhase(room, state.value, caseFile);
  }

  private enterPhase(room: RoomState, phase: Phase, caseFile: CaseFile | null): (() => Promise<void>)[] {
    const r = this.deps.rules;
    const now = Date.now();
    const after: (() => Promise<void>)[] = [];
    const announce = async () => {
      this.deps.out.room(room.code, "phase:changed", {
        phase,
        round: room.machine.context.round,
        phaseEndsAt: room.phaseEndsAt,
      });
      await this.broadcastState(room);
    };

    switch (phase) {
      case "lobby":
        room.phaseEndsAt = null;
        room.questionsUsed = {};
        room.unlockedClueIds = [];
        room.votes = {};
        room.confessedId = null;
        room.caseId = null;
        room.gameId = null;
        room.gameStartedAt = null;
        break;
      case "generating":
        room.phaseEndsAt = null;
        room.generation = { status: "running", attempt: 1, maxAttempts: r.maxCaseAttempts, message: "Writing the case file..." };
        after.push(async () => {
          void this.runCaseGeneration(room.code, roomTheme(room));
        });
        break;
      case "briefing":
        room.phaseEndsAt = now + r.briefingSeconds * 1000;
        room.gameStartedAt = now;
        break;
      case "interrogation": {
        room.phaseEndsAt = now + r.roundSeconds * 1000;
        room.questionsUsed = {};
        // New evidence unlocks between rounds: every clue up to this round.
        const round = room.machine.context.round;
        const fresh: PublicClue[] = (caseFile?.clues ?? [])
          .filter((c) => c.round <= round && !room.unlockedClueIds.includes(c.id))
          .map(publicClue);
        room.unlockedClueIds = [...room.unlockedClueIds, ...fresh.map((c) => c.id)];
        if (fresh.length) after.push(async () => this.deps.out.room(room.code, "clue:unlocked", fresh));
        break;
      }
      case "discussion":
        room.phaseEndsAt = now + r.discussionSeconds * 1000;
        break;
      case "voting":
        room.phaseEndsAt = now + r.voteSeconds * 1000;
        break;
      case "reveal":
        room.phaseEndsAt = null;
        after.push(() => this.reveal(room));
        break;
    }
    after.push(announce);
    return after;
  }

  async start(code: string, playerId: string) {
    await this.mutateRoom(code, (room) => {
      this.assertHost(room, playerId);
      if (room.machine.value !== "lobby") throw new GameError("The game has already started.");
      return this.transition(room, { type: "START" });
    });
  }

  /** Host skips the rest of the current phase. */
  async advance(code: string, playerId: string) {
    const caseFile = await this.getCase(code);
    await this.mutateRoom(code, (room) => {
      this.assertHost(room, playerId);
      if (!["briefing", "interrogation", "discussion", "voting"].includes(room.machine.value)) {
        throw new GameError("There is nothing to skip right now.");
      }
      return this.advanceLocked(room, caseFile);
    });
  }

  private advanceLocked(room: RoomState, caseFile: CaseFile | null) {
    return this.transition(room, { type: "ADVANCE" }, caseFile);
  }

  async restart(code: string, playerId: string) {
    const caseFile = await this.getCase(code);
    await this.mutateRoom(code, async (room) => {
      this.assertHost(room, playerId);
      if (room.machine.value !== "reveal") throw new GameError("You can start a new case after the reveal.");
      const suspectKeys = (caseFile?.suspects ?? []).flatMap((s) => [keys.slice(code, s.id), keys.suspect(code, s.id)]);
      await this.store.del(
        keys.case(code),
        keys.messages(code),
        keys.notes(code),
        keys.reveal(code),
        keys.tokens(code),
        keys.costMicros(code),
        ...suspectKeys,
      );
      room.generation = idleGeneration(this.deps.rules.maxCaseAttempts);
      const after = this.transition(room, { type: "RESTART" });
      after.push(async () => {
        this.deps.out.room(code, "messages:sync", []);
        this.deps.out.room(code, "notes:sync", []);
      });
      return after;
    });
  }

  /** Called every second by the server: advances rooms whose phase timer ran out. */
  async tick() {
    const now = Date.now();
    for (const code of await this.store.smembers(keys.activeRooms)) {
      const room = await this.getRoom(code);
      if (!room) {
        await this.store.srem(keys.activeRooms, code);
        continue;
      }
      if (room.phaseEndsAt === null || room.phaseEndsAt > now) continue;
      try {
        const caseFile = await this.getCase(code);
        await this.mutateRoom(code, (room) => {
          // Re-check under the lock: another instance may have advanced it.
          if (room.phaseEndsAt === null || room.phaseEndsAt > Date.now()) return;
          return this.advanceLocked(room, caseFile);
        });
      } catch (err) {
        console.error(`[tick] room ${code}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Game setup (flow A)
  // -------------------------------------------------------------------------

  /** New settings for the picker. Not tied to a room: any player can ask, before or between games. */
  async generateThemes(avoid: string[]): Promise<Theme[]> {
    const { themes } = await generateThemes(this.deps.llm, avoid);
    if (!themes.length) throw new GameError("The AI didn't come up with anything new. Try again.");
    return themes;
  }

  private async runCaseGeneration(code: string, theme: Theme) {
    const r = this.deps.rules;
    try {
      const generated = await generateCase(this.deps.llm, theme, {
        rounds: r.rounds,
        maxAttempts: r.maxCaseAttempts,
        onProgress: (p) => {
          void this.mutateRoom(code, (room) => {
            room.generation = { status: "running", attempt: p.attempt, maxAttempts: r.maxCaseAttempts, message: p.message };
          })
            .then((room) => this.broadcastState(room))
            .catch(() => {});
        },
      });
      await this.recordUsage(code, generated.usage);

      // Build per-suspect slices and fresh memories; the full case stays server-side.
      const caseFile = generated.caseFile;
      await this.setJson(keys.case(code), caseFile);
      for (const slice of buildSlices(caseFile)) {
        await this.setJson(keys.slice(code, slice.suspectId), slice);
        const memory: SuspectMemory = {
          stress: slice.isKiller ? BASE_STRESS.killer : BASE_STRESS.innocent,
          statements: [],
          evidenceSeen: [],
          summary: "",
        };
        await this.setJson(keys.suspect(code, slice.suspectId), memory);
      }
      const caseId = randomUUID();
      const gameId = randomUUID();
      this.deps.db.saveCase(caseId, caseFile, generated.attempts, this.deps.llm.mode);

      await this.mutateRoom(code, (room) => {
        if (room.machine.value !== "generating") return;
        room.caseId = caseId;
        room.gameId = gameId;
        room.generation = {
          status: "ready",
          attempt: generated.attempts,
          maxAttempts: r.maxCaseAttempts,
          message: `Case ready (solver cracked it on attempt ${generated.attempts}).`,
        };
        this.deps.db.createGame(gameId, caseId, code, room.players.map((p) => ({ id: p.id, name: p.name })));
        return this.transition(room, { type: "CASE_READY" });
      });
    } catch (err) {
      if (err instanceof CaseGenerationError) await this.recordUsage(code, err.usage);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[generate] room ${code}:`, message);
      await this.mutateRoom(code, (room) => {
        room.generation = { status: "failed", attempt: r.maxCaseAttempts, maxAttempts: r.maxCaseAttempts, message };
        return this.transition(room, { type: "CASE_FAILED" });
      }).catch(() => {});
    }
  }

  // -------------------------------------------------------------------------
  // Interrogation (flow B)
  // -------------------------------------------------------------------------

  async ask(code: string, playerId: string, input: { suspectId: string; text: string; private: boolean }) {
    return this.beginTurn(code, playerId, { ...input, clueId: null });
  }

  async present(
    code: string,
    playerId: string,
    input: { suspectId: string; clueId: string; text?: string; private: boolean },
  ) {
    return this.beginTurn(code, playerId, {
      suspectId: input.suspectId,
      text: input.text?.trim() || "What can you tell me about this?",
      private: input.private,
      clueId: input.clueId,
    });
  }

  /** Steps 1-2: validate phase, budget and rate limit, then hand off to the suspect. */
  private async beginTurn(
    code: string,
    playerId: string,
    input: { suspectId: string; text: string; private: boolean; clueId: string | null },
  ): Promise<string> {
    const r = this.deps.rules;
    const caseFile = await this.getCase(code);
    if (!caseFile) throw new GameError("There is no case in progress.");
    const suspect = caseFile.suspects.find((s) => s.id === input.suspectId);
    if (!suspect) throw new GameError("Unknown suspect.");

    const { tokens } = await this.tokenUsage(code);
    if (tokens >= r.roomTokenBudget) {
      throw new GameError("This room has used up its AI budget. Move on to the discussion and vote!");
    }

    let pending: ReplyPending | null = null;
    let questionsLeft = 0;
    await this.mutateRoom(code, async (room) => {
      if (room.machine.value !== "interrogation") throw new GameError("You can only question suspects during an interrogation round.");
      const player = room.players.find((p) => p.id === playerId);
      if (!player) throw new GameError("You are not in this room.");
      if (input.clueId && !room.unlockedClueIds.includes(input.clueId)) throw new GameError("That clue hasn't been unlocked yet.");
      const used = room.questionsUsed[playerId] ?? 0;
      if (used >= r.questionsPerRound) throw new GameError("You've used all your questions for this round.");
      const cooldownMs = r.askCooldownSeconds * 1000;
      if (cooldownMs > 0 && !(await this.store.setNx(keys.rateLimit(code, playerId), "1", cooldownMs))) {
        throw new GameError("Slow down, detective - wait a moment before your next question.");
      }
      room.questionsUsed[playerId] = used + 1;
      questionsLeft = r.questionsPerRound - used - 1;
      pending = {
        messageId: randomUUID(),
        suspectId: suspect.id,
        askerId: playerId,
        askerName: player.name,
        visibility: input.private ? "private" : "public",
        kind: input.clueId ? "present" : "question",
        question: input.text,
        clueId: input.clueId,
        round: room.machine.context.round,
      };
    });
    const p = pending as unknown as ReplyPending;

    this.deps.out.player(playerId, "budget:update", { questionsLeft, tokenUsed: tokens, tokenBudget: r.roomTokenBudget });
    this.emitTo(code, p.visibility, playerId, "reply:pending", p);
    void this.runTurn(code, p, caseFile).catch((err) => {
      console.error(`[turn] room ${code}:`, err instanceof Error ? err.message : err);
      this.emitTo(code, p.visibility, playerId, "reply:failed", {
        messageId: p.messageId,
        error: "The suspect didn't answer. Try again.",
      });
    });
    const room = await this.requireRoom(code);
    await this.broadcastState(room);
    return p.messageId;
  }

  private emitTo<E extends keyof ServerToClientEvents>(
    code: string,
    visibility: Visibility,
    playerId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    if (visibility === "public") this.deps.out.room(code, event, ...args);
    else this.deps.out.player(playerId, event, ...args);
  }

  /** Steps 3-8: build the prompt, draft, guard, send, update memory, check triggers. */
  private async runTurn(code: string, p: ReplyPending, caseFile: CaseFile) {
    const r = this.deps.rules;
    const clue: Clue | null = p.clueId ? (caseFile.clues.find((c) => c.id === p.clueId) ?? null) : null;

    const { message, stress, confessed } = await withLock(
      this.store,
      keys.suspectLock(code, p.suspectId),
      async () => {
        const slice = await this.getSlice(code, p.suspectId);
        const memory = await this.getMemory(code, p.suspectId);
        if (!slice || !memory) throw new Error("suspect state missing");
        const room = await this.requireRoom(code);

        const stress = applyStress(slice, memory.stress, stressDelta(slice, clue, p.question));
        const evidenceSeen = clue && !memory.evidenceSeen.includes(clue.id) ? [...memory.evidenceSeen, clue.id] : memory.evidenceSeen;
        const mustConfess = confessionAllowed({
          slice,
          stress,
          evidenceSeen,
          caseFile,
          threshold: r.confessionStress,
          alreadyConfessed: room.confessedId !== null,
        });

        // The suspect sees evidence it has been shown, and nothing else from the case.
        const shown = caseFile.clues.filter((c) => memory.evidenceSeen.includes(c.id)).map((c) => ({ id: c.id, text: c.text }));
        const result = await runSuspectTurn(this.deps.llm, {
          slice,
          memory: { summary: memory.summary, statements: memory.statements, evidenceSeen: shown, stress },
          asker: { name: p.askerName, visibility: p.visibility },
          question: p.question,
          presentedClue: clue ? { id: clue.id, text: clue.text } : null,
          directives: { mustConfess, slipping: !mustConfess && stress >= SLIP_STRESS },
        });
        await this.recordUsage(code, result.usage);

        const message: ChatMessage = {
          id: p.messageId,
          suspectId: p.suspectId,
          askerId: p.askerId,
          askerName: p.askerName,
          visibility: p.visibility,
          kind: p.kind,
          question: p.question,
          clueId: p.clueId,
          reply: result.text,
          round: p.round,
          ts: Date.now(),
          deflected: result.deflected,
          confession: mustConfess,
        };

        // Update the suspect's private memory before anyone else can question them.
        const statement: Statement = {
          askerName: p.askerName,
          visibility: p.visibility,
          kind: p.kind,
          question: p.question,
          clueId: p.clueId,
          reply: result.text,
          round: p.round,
        };
        const next: SuspectMemory = {
          stress,
          evidenceSeen,
          statements: [...memory.statements, statement],
          summary: memory.summary,
        };
        if (next.statements.length >= MEMORY_COMPACT_AT) {
          const old = next.statements.slice(0, next.statements.length - MEMORY_KEEP);
          try {
            const { summary, usage } = await this.deps.llm.summarize(slice.name, old, next.summary);
            await this.recordUsage(code, usage);
            next.summary = summary;
            next.statements = next.statements.slice(-MEMORY_KEEP);
          } catch (err) {
            console.warn("[memory] summarise failed, keeping full history:", err instanceof Error ? err.message : err);
          }
        }
        await this.setJson(keys.suspect(code, p.suspectId), next);
        await this.store.rpush(keys.messages(code), JSON.stringify(message), this.ttl);
        return { message, stress, confessed: mustConfess };
      },
      { ttlMs: 180_000, waitMs: 120_000 },
    );

    if (confessed) {
      await this.mutateRoom(code, (room) => {
        room.confessedId = p.suspectId;
      });
    }

    // Send: typewriter effect, then the final message.
    await this.typewrite(code, p, message.reply);
    this.emitTo(code, p.visibility, p.askerId, "reply:done", message);
    if (this.deps.db.enabled) {
      const room = await this.getRoom(code);
      if (room?.gameId) this.deps.db.saveMessage(room.gameId, message);
    }

    const room = await this.getRoom(code);
    if (room) {
      const view = await this.view(room);
      const suspect = view.case?.suspects.find((s) => s.id === p.suspectId);
      if (suspect) this.deps.out.room(code, "suspect:update", { ...suspect, stress });
      this.deps.out.room(code, "room:state", view);
    }
  }

  private async typewrite(code: string, p: ReplyPending, text: string) {
    const delay = this.deps.typewriterMs ?? 40;
    const chunks = text.match(/\S+\s*/g) ?? [text];
    for (let i = 0; i < chunks.length; i += 2) {
      this.emitTo(code, p.visibility, p.askerId, "reply:chunk", { messageId: p.messageId, delta: chunks.slice(i, i + 2).join("") });
      if (delay) await new Promise((r) => setTimeout(r, delay));
    }
  }

  // -------------------------------------------------------------------------
  // Vote and reveal
  // -------------------------------------------------------------------------

  async vote(code: string, playerId: string, suspectId: string) {
    const caseFile = await this.getCase(code);
    if (!caseFile?.suspects.some((s) => s.id === suspectId)) throw new GameError("Unknown suspect.");
    const room = await this.mutateRoom(code, (room) => {
      if (room.machine.value !== "voting") throw new GameError("Voting hasn't started.");
      if (!room.players.some((p) => p.id === playerId)) throw new GameError("You are not in this room.");
      if (room.votes[playerId]) throw new GameError("You have already voted.");
      room.votes[playerId] = suspectId;
      const everyone = room.players.filter((p) => p.connected).every((p) => room.votes[p.id]);
      if (everyone) return this.advanceLocked(room, caseFile);
    });
    if (room.machine.value === "voting") await this.broadcastState(room);
  }

  private async reveal(room: RoomState) {
    const code = room.code;
    const caseFile = await this.getCase(code);
    if (!caseFile) return;
    const messages = await this.getMessages(code);
    const usage = await this.tokenUsage(code);
    const killer = caseFile.suspects.find((s) => s.id === caseFile.killerId)!;
    const verdict = roomVerdict(room.votes);
    const durationSec = room.gameStartedAt ? Math.round((Date.now() - room.gameStartedAt) / 1000) : 0;

    const payload: RevealPayload = {
      killerId: killer.id,
      killerName: killer.name,
      summary: caseFile.solution.summary,
      timeline: caseFile.solution.timeline,
      clues: caseFile.clues.map((c) => ({ ...publicClue(c), pointsTo: c.pointsTo, isKey: c.isKey, contradicts: c.contradicts })),
      suspects: caseFile.suspects.map((s) => ({
        id: s.id,
        name: s.name,
        motive: s.motive,
        alibi: s.alibi,
        secret: s.secret,
        timeline: s.timeline,
      })),
      votes: room.votes,
      scores: scorePlayers(room.players, room.votes, messages, caseFile),
      playersWon: verdict === caseFile.killerId,
      stats: { tokens: usage.tokens, costUsd: usage.costUsd, durationSec },
    };
    await this.setJson(keys.reveal(code), payload);
    this.deps.out.room(code, "reveal", payload);
    // Private conversations are revealed at the end, as part of the full transcript.
    this.deps.out.room(code, "messages:sync", messages);

    if (room.gameId && room.caseId) {
      this.deps.db.finishGame(room.gameId, room.caseId, {
        votes: room.votes,
        solved: payload.playersWon,
        durationSec,
        tokens: usage.tokens,
        costUsd: usage.costUsd,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Shared notes (pinboard)
  // -------------------------------------------------------------------------

  private async mutateNotes(code: string, fn: (notes: NoteItem[]) => NoteItem[]) {
    await this.requireRoom(code);
    const notes = await withLock(this.store, keys.notesLock(code), async () => {
      const next = fn(await this.getNotes(code));
      await this.setJson(keys.notes(code), next);
      return next;
    });
    this.deps.out.room(code, "notes:sync", notes);
  }

  async addNote(code: string, playerId: string, input: Required<NoteAddInput>) {
    await this.mutateNotes(code, (notes) => {
      if (notes.length >= 60) throw new GameError("The pinboard is full.");
      return [...notes, { id: randomUUID().slice(0, 12), authorId: playerId, ...input }];
    });
  }

  async moveNote(code: string, input: { id: string; x: number; y: number }) {
    await this.mutateNotes(code, (notes) => notes.map((n) => (n.id === input.id ? { ...n, x: input.x, y: input.y } : n)));
  }

  async removeNote(code: string, id: string) {
    await this.mutateNotes(code, (notes) => notes.filter((n) => n.id !== id));
  }
}
