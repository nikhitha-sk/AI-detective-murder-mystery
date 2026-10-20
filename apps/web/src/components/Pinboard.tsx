"use client";

import type { NoteItem } from "@mystery/shared";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { useGame } from "@/store/game";
import { Avatar, Button, cx } from "./ui";

const BOARD_W = 1100;
const BOARD_H = 640;
const NOTE_COLORS = ["#fde68a", "#fbcfe8", "#bbf7d0", "#bfdbfe"];

function Pin({ note, constraints }: { note: NoteItem; constraints: React.RefObject<HTMLDivElement | null> }) {
  const move = useGame((s) => s.moveNote);
  const remove = useGame((s) => s.removeNote);
  const suspect = useGame((s) => s.view?.case?.suspects.find((x) => x.id === note.refId));
  const players = useGame((s) => s.view?.players ?? []);
  const author = players.find((p) => p.id === note.authorId)?.name;
  const tilt = ((note.id.charCodeAt(0) + note.id.charCodeAt(1)) % 7) - 3;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={constraints}
      onDragEnd={(_, info) => {
        const x = Math.max(0, Math.min(BOARD_W - 160, note.x + info.offset.x));
        const y = Math.max(0, Math.min(BOARD_H - 80, note.y + info.offset.y));
        move(note.id, Math.round(x), Math.round(y));
      }}
      whileDrag={{ scale: 1.05, rotate: 0, zIndex: 20 }}
      initial={{ rotate: tilt }}
      className="group absolute w-44 cursor-grab touch-none select-none active:cursor-grabbing"
      style={{ left: note.x, top: note.y }}
    >
      <span className="absolute -top-1.5 left-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-blood-500 shadow ring-2 ring-black/30" />
      <div
        className={cx("rounded-sm p-3 pt-4 text-[13px] text-[#2b2116] shadow-xl", note.kind === "clue" && "font-type")}
        style={{ background: note.color }}
      >
        {note.kind === "suspect" && suspect ? (
          <div className="flex items-center gap-2">
            <Avatar id={suspect.id} name={suspect.name} size={34} />
            <div>
              <p className="font-display font-bold leading-tight">{suspect.name}</p>
              <p className="text-[11px] opacity-70">{suspect.role}</p>
            </div>
          </div>
        ) : (
          <p className="leading-snug">
            {note.kind === "clue" && <span className="mr-1 font-bold">{note.refId}:</span>}
            {note.text}
          </p>
        )}
        {author && <p className="mt-1.5 text-[10px] opacity-50">- {author}</p>}
      </div>
      <button
        onClick={() => remove(note.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -right-2 -top-2 hidden h-5 w-5 place-items-center rounded-full bg-ink-900 text-[10px] text-ink-100 group-hover:grid"
        aria-label="Remove from board"
      >
        ✕
      </button>
    </motion.div>
  );
}

export function Pinboard() {
  const notes = useGame((s) => s.notes);
  const suspects = useGame((s) => s.view?.case?.suspects ?? []);
  const addNote = useGame((s) => s.addNote);
  const board = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState(NOTE_COLORS[0]);

  const spot = () => ({ x: 30 + Math.round(Math.random() * 700), y: 30 + Math.round(Math.random() * 420) });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/80 p-3">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addNote({ kind: "note", refId: null, text: text.trim(), color, ...spot() })
              .then(() => setText(""))
              .catch(() => {});
          }}
        >
          <input
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a note for everyone..."
            className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-plum-500"
          />
          <div className="flex gap-1">
            {NOTE_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={cx("h-6 w-6 rounded-full", color === c && "ring-2 ring-white")}
                style={{ background: c }}
                aria-label={`Note colour ${c}`}
              />
            ))}
          </div>
          <Button type="submit" variant="ghost" className="py-2">
            Pin note
          </Button>
        </form>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) addNote({ kind: "suspect", refId: e.target.value, text: "", color: "#e9e3f5", ...spot() }).catch(() => {});
          }}
          className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm"
          aria-label="Pin a suspect"
        >
          <option value="">Pin a suspect...</option>
          {suspects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="scrollbar-thin overflow-auto">
        <div ref={board} className="corkboard relative" style={{ width: BOARD_W, height: BOARD_H }}>
          {notes.length === 0 && (
            <p className="absolute inset-0 grid place-items-center text-center text-sm text-[#f4ead2]/60">
              Pin suspects, evidence and notes here. Everyone in the room sees the same board.
            </p>
          )}
          {notes.map((n) => (
            // Keyed on position: a move remounts the pin so the drag transform resets.
            <Pin key={`${n.id}-${n.x}-${n.y}`} note={n} constraints={board} />
          ))}
        </div>
      </div>
    </div>
  );
}
