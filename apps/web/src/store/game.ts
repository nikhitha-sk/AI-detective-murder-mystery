"use client";

import type { ChatMessage, NoteAddInput, NoteItem, Phase, RevealPayload, RoomView } from "@mystery/shared";
import { create } from "zustand";
import { getPlayerId, saveName } from "@/lib/identity";
import { getSocket, request } from "@/lib/socket";

export type UiMessage = ChatMessage & { status: "pending" | "streaming" | "done" | "failed" };

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error" | "clue";
}

interface GameState {
  playerId: string;
  connected: boolean;
  code: string | null;
  name: string;
  view: RoomView | null;
  messages: Record<string, UiMessage>;
  order: string[];
  notes: NoteItem[];
  reveal: RevealPayload | null;
  toasts: Toast[];
  selectedSuspectId: string | null;
  /** Clue the player has picked to present next. */
  pendingClueId: string | null;

  connect(): void;
  createRoom(name: string, theme: string, solo: boolean): Promise<string>;
  joinRoom(code: string, name: string): Promise<void>;
  leaveRoom(): void;
  setTheme(theme: string): Promise<void>;
  start(): Promise<void>;
  advance(): Promise<void>;
  restart(): Promise<void>;
  ask(suspectId: string, text: string, isPrivate: boolean): Promise<void>;
  present(suspectId: string, clueId: string, text: string, isPrivate: boolean): Promise<void>;
  vote(suspectId: string): Promise<void>;
  addNote(input: NoteAddInput): Promise<void>;
  moveNote(id: string, x: number, y: number): void;
  removeNote(id: string): void;
  selectSuspect(id: string | null): void;
  pickClue(id: string | null): void;
  toast(text: string, tone?: Toast["tone"]): void;
  dismissToast(id: number): void;
}

const PHASE_LABEL: Record<Phase, string> = {
  lobby: "Back in the lobby",
  generating: "Writing the case...",
  briefing: "Briefing: read the case file",
  interrogation: "Interrogation",
  discussion: "Discussion: compare notes",
  voting: "Accusation: cast your vote",
  reveal: "The reveal",
};

let listenersBound = false;
let toastId = 0;

export const useGame = create<GameState>((set, get) => {
  const fail = (err: unknown) => {
    get().toast(err instanceof Error ? err.message : String(err), "error");
    throw err;
  };

  return {
    playerId: "",
    connected: false,
    code: null,
    name: "",
    view: null,
    messages: {},
    order: [],
    notes: [],
    reveal: null,
    toasts: [],
    selectedSuspectId: null,
    pendingClueId: null,

    connect() {
      if (listenersBound) return;
      listenersBound = true;
      const socket = getSocket();
      set({ playerId: getPlayerId(), connected: socket.connected });

      socket.on("connect", () => {
        set({ connected: true });
        // Rejoin after a reconnect (server restart, network blip).
        const { code, name } = get();
        if (code && name) request("room:join", { code, name }).catch(() => {});
      });
      socket.on("disconnect", () => set({ connected: false }));
      socket.on("connect_error", () => set({ connected: false }));

      socket.on("room:state", (view) => {
        const prev = get().view;
        set({ view });
        if (!get().selectedSuspectId && view.case) set({ selectedSuspectId: view.case.suspects[0]?.id ?? null });
        if (prev && prev.phase === "generating" && view.phase === "lobby" && view.generation.status === "failed") {
          get().toast(view.generation.message, "error");
        }
      });
      socket.on("phase:changed", ({ phase, round }) => {
        get().toast(phase === "interrogation" ? `Interrogation, round ${round}` : PHASE_LABEL[phase]);
        if (phase === "lobby") set({ reveal: null, selectedSuspectId: null, pendingClueId: null });
      });
      socket.on("messages:sync", (list) => {
        const messages: Record<string, UiMessage> = {};
        for (const m of list) messages[m.id] = { ...m, status: "done" };
        // Keep in-flight replies that are not in the snapshot yet.
        for (const id of get().order) {
          const m = get().messages[id];
          if (m && m.status !== "done" && !messages[id]) messages[id] = m;
        }
        const order = Object.values(messages)
          .sort((a, b) => a.ts - b.ts)
          .map((m) => m.id);
        set({ messages, order });
      });
      socket.on("reply:pending", ({ messageId, ...p }) => {
        const m: UiMessage = { ...p, id: messageId, reply: "", ts: Date.now(), deflected: false, confession: false, status: "pending" };
        set((s) => ({ messages: { ...s.messages, [messageId]: m }, order: [...s.order, messageId] }));
      });
      socket.on("reply:chunk", ({ messageId, delta }) => {
        const m = get().messages[messageId];
        if (!m) return;
        set((s) => ({ messages: { ...s.messages, [messageId]: { ...m, reply: m.reply + delta, status: "streaming" } } }));
      });
      socket.on("reply:done", (message) => {
        set((s) => ({
          messages: { ...s.messages, [message.id]: { ...message, status: "done" } },
          order: s.order.includes(message.id) ? s.order : [...s.order, message.id],
        }));
        if (message.confession) {
          const name = get().view?.case?.suspects.find((x) => x.id === message.suspectId)?.name ?? "A suspect";
          get().toast(`${name} has confessed!`, "error");
        }
      });
      socket.on("reply:failed", ({ messageId, error }) => {
        const m = get().messages[messageId];
        if (m) set((s) => ({ messages: { ...s.messages, [messageId]: { ...m, status: "failed" } } }));
        get().toast(error, "error");
      });
      socket.on("clue:unlocked", (clues) => {
        for (const c of clues) get().toast(`New evidence: ${c.text}`, "clue");
      });
      socket.on("suspect:update", (suspect) => {
        const view = get().view;
        if (!view?.case) return;
        set({
          view: {
            ...view,
            case: { ...view.case, suspects: view.case.suspects.map((s) => (s.id === suspect.id ? suspect : s)) },
          },
        });
      });
      socket.on("budget:update", ({ questionsLeft }) => {
        const view = get().view;
        if (!view) return;
        const me = get().playerId;
        set({ view: { ...view, players: view.players.map((p) => (p.id === me ? { ...p, questionsLeft } : p)) } });
      });
      socket.on("notes:sync", (notes) => set({ notes }));
      socket.on("reveal", (reveal) => set({ reveal }));
      socket.on("server:error", ({ message }) => get().toast(message, "error"));
    },

    async createRoom(name, theme, solo) {
      get().connect();
      saveName(name);
      const { code } = await request<{ code: string }>("room:create", { name, theme, solo }).catch(fail);
      set({ code, name, messages: {}, order: [], notes: [], reveal: null, selectedSuspectId: null });
      return code;
    },

    async joinRoom(code, name) {
      get().connect();
      saveName(name);
      if (get().code !== code) set({ messages: {}, order: [], notes: [], reveal: null, selectedSuspectId: null, view: null });
      set({ code, name });
      await request("room:join", { code, name }).catch((err) => {
        set({ code: null });
        return fail(err);
      });
    },

    leaveRoom() {
      getSocket().emit("room:leave");
      set({ code: null, view: null, messages: {}, order: [], notes: [], reveal: null, selectedSuspectId: null });
    },

    setTheme: (theme) => request("room:setTheme", { theme }).catch(fail),
    start: () => request("game:start").catch(fail),
    advance: () => request("game:advance").catch(fail),
    restart: () => request("game:restart").catch(fail),

    async ask(suspectId, text, isPrivate) {
      await request("ask", { suspectId, text, private: isPrivate }).catch(fail);
    },

    async present(suspectId, clueId, text, isPrivate) {
      await request("present", { suspectId, clueId, text: text || undefined, private: isPrivate }).catch(fail);
      set({ pendingClueId: null });
    },

    vote: (suspectId) => request("vote", { suspectId }).catch(fail),

    addNote: (input) => request("notes:add", input).catch(fail),

    moveNote(id, x, y) {
      // Optimistic: the server's notes:sync confirms it.
      set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, x, y } : n)) }));
      getSocket().emit("notes:move", { id, x, y });
    },

    removeNote(id) {
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      getSocket().emit("notes:remove", { id });
    },

    selectSuspect: (id) => set({ selectedSuspectId: id }),
    pickClue: (id) => set({ pendingClueId: id }),

    toast(text, tone = "info") {
      const id = ++toastId;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
      setTimeout(() => get().dismissToast(id), tone === "error" ? 6000 : 4500);
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
});

/** Convenience selectors. */
export const useMe = () => {
  const playerId = useGame((s) => s.playerId);
  const view = useGame((s) => s.view);
  return view?.players.find((p) => p.id === playerId) ?? null;
};
