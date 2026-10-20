"use client";

import type { NoteAddInput, NoteItem, PublicClue, PublicSuspect } from "@mystery/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGame } from "@/store/game";
import { newId } from "./ink";

/** Where the board's pinned items live: the room (shared with everyone) or this browser. */
export interface BoardSource {
  scope: string;
  shared: boolean;
  theme: string;
  notes: NoteItem[];
  suspects: PublicSuspect[];
  clues: PublicClue[];
  playerName(id: string): string | undefined;
  add(input: NoteAddInput): Promise<void>;
  move(id: string, x: number, y: number): void;
  remove(id: string): void;
  edit(note: NoteItem, text: string): Promise<void>;
}

const LOCAL_KEY = "ai-detective:notes:home";

export function useLocalBoard(): BoardSource {
  const [notes, setNotes] = useState<NoteItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) setNotes(JSON.parse(raw) as NoteItem[]);
    } catch {
      /* start empty */
    }
  }, []);

  const persist = useCallback((fn: (n: NoteItem[]) => NoteItem[]) => {
    setNotes((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        /* session only */
      }
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      scope: "home",
      shared: false,
      theme: "manor-1920s",
      notes,
      suspects: [],
      clues: [],
      playerName: () => undefined,
      async add(input) {
        persist((n) => [
          ...n,
          { id: newId(), authorId: "me", kind: input.kind, refId: input.refId ?? null, text: input.text ?? "", x: input.x, y: input.y, color: input.color ?? "#fde68a" },
        ]);
      },
      move: (id, x, y) => persist((n) => n.map((it) => (it.id === id ? { ...it, x, y } : it))),
      remove: (id) => persist((n) => n.filter((it) => it.id !== id)),
      async edit(note, text) {
        persist((n) => n.map((it) => (it.id === note.id ? { ...it, text } : it)));
      },
    }),
    [notes, persist],
  );
}

export function useRoomBoard(): BoardSource | null {
  const view = useGame((s) => s.view);
  const notes = useGame((s) => s.notes);
  const addNote = useGame((s) => s.addNote);
  const moveNote = useGame((s) => s.moveNote);
  const removeNote = useGame((s) => s.removeNote);

  return useMemo(() => {
    if (!view) return null;
    return {
      scope: `room-${view.code}`,
      shared: true,
      theme: view.theme,
      notes,
      suspects: view.case?.suspects ?? [],
      clues: view.clues,
      playerName: (id: string) => view.players.find((p) => p.id === id)?.name,
      add: addNote,
      move: moveNote,
      remove: removeNote,
      // The server has no edit: replace the note in place.
      async edit(note, text) {
        await addNote({ kind: note.kind, refId: note.refId, text, x: note.x, y: note.y, color: note.color });
        removeNote(note.id);
      },
    };
  }, [view, notes, addNote, moveNote, removeNote]);
}
