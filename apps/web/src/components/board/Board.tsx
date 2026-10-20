"use client";

import type { NoteItem } from "@mystery/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { baselineExpression } from "@/lib/expression";
import { Portrait, suspectSeed } from "../Portrait";
import { cx } from "../ui";
import { addPoint, eraseAt, newId, pathOf, textFontSize, useInk, type Stroke } from "./ink";
import type { BoardSource } from "./sources";

export const BOARD_W = 1600;
export const BOARD_H = 1000;

type Tool = "move" | "pen" | "highlighter" | "string" | "text" | "note" | "eraser";

const INK_COLORS = ["#e11d48", "#111827", "#2563eb", "#f5f5f4", "#facc15", "#16a34a"];
const NOTE_COLORS = ["#fde68a", "#fbcfe8", "#bbf7d0", "#bfdbfe", "#f4ead2"];
const SIZES = [2, 4, 8];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("h-[18px] w-[18px]", className)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const icons = {
  move: (
    <Icon>
      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
    </Icon>
  ),
  pen: (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </Icon>
  ),
  highlighter: (
    <Icon>
      <path d="M9 11l-6 6v3h9l3-3" />
      <path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4" />
    </Icon>
  ),
  string: (
    <Icon>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M6.5 7.5l11 9" />
    </Icon>
  ),
  text: (
    <Icon>
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </Icon>
  ),
  note: (
    <Icon>
      <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5z" />
      <path d="M15 3v6h6" />
    </Icon>
  ),
  eraser: (
    <Icon>
      <path d="M7 21l-4.3-4.3a1 1 0 010-1.4l10-10a1 1 0 011.4 0l5.6 5.6a1 1 0 010 1.4L11 21" />
      <path d="M22 21H7M5 11l9 9" />
    </Icon>
  ),
  undo: (
    <Icon>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 00-15-6.7L3 13" />
    </Icon>
  ),
  redo: (
    <Icon>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0115-6.7L21 13" />
    </Icon>
  ),
  trash: (
    <Icon>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Icon>
  ),
  plus: (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  ),
  minus: (
    <Icon>
      <path d="M5 12h14" />
    </Icon>
  ),
  user: (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </Icon>
  ),
  file: (
    <Icon>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </Icon>
  ),
  board: (
    <Icon>
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M7 21l2-4M17 21l-2-4M8 8l3 3 5-4" />
    </Icon>
  ),
};

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "move", label: "Move pins", key: "V" },
  { id: "pen", label: "Pen", key: "P" },
  { id: "highlighter", label: "Highlighter", key: "H" },
  { id: "string", label: "Red string (connect)", key: "S" },
  { id: "text", label: "Write text", key: "T" },
  { id: "note", label: "Sticky note", key: "N" },
  { id: "eraser", label: "Eraser", key: "E" },
];

function ToolButton({ active, onClick, title, children, disabled }: { active?: boolean; onClick: () => void; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30",
        active ? "bg-clue-400 text-ink-950 shadow-[0_0_14px_rgb(245_184_61/0.45)]" : "text-ink-100 hover:bg-ink-700",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pinned items
// ---------------------------------------------------------------------------

function NoteCard({
  note,
  source,
  editing,
  onEdit,
  onCommitEdit,
}: {
  note: NoteItem;
  source: BoardSource;
  editing: boolean;
  onEdit: () => void;
  onCommitEdit: (text: string | null) => void;
}) {
  const suspect = note.kind === "suspect" ? source.suspects.find((s) => s.id === note.refId) : undefined;
  const author = source.shared ? source.playerName(note.authorId) : undefined;
  const tilt = ((note.id.charCodeAt(0) + note.id.charCodeAt(note.id.length - 1)) % 7) - 3;
  const [draft, setDraft] = useState(note.text);

  if (note.kind === "suspect") {
    return (
      <div className="w-[150px] rounded-sm bg-[#f7f4ee] p-2 pb-3 shadow-[0_10px_24px_rgb(0_0_0/0.5)]" style={{ rotate: `${tilt}deg` }}>
        <div className="overflow-hidden bg-gradient-to-b from-[#3a3046] to-[#1a1520]">
          {suspect ? (
            <Portrait seed={suspectSeed(suspect, source.theme)} expression={suspect.confessed ? "broken" : baselineExpression(suspect.stress)} crop="head" size={134} />
          ) : (
            <div className="grid h-[134px] place-items-center text-4xl text-ink-400">?</div>
          )}
        </div>
        <p className="mt-1.5 text-center font-hand text-xl leading-none text-[#2b2116]">{suspect?.name ?? "Unknown"}</p>
        {suspect && <p className="truncate text-center text-[10px] text-[#2b2116]/60">{suspect.role}</p>}
      </div>
    );
  }

  if (note.kind === "clue") {
    return (
      <div className="paper w-[200px] p-3 pt-4 shadow-[0_10px_24px_rgb(0_0_0/0.5)]" style={{ rotate: `${tilt}deg` }}>
        <p className="font-type text-[10px] uppercase tracking-widest opacity-60">Exhibit {note.refId}</p>
        <p className="mt-1 line-clamp-6 font-type text-[12px] leading-snug">{note.text}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-[176px] p-3 pt-5 shadow-[0_10px_24px_rgb(0_0_0/0.5)]"
      style={{ background: note.color, rotate: `${tilt}deg` }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      <span className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 rotate-[-4deg] bg-white/40 shadow-sm" />
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => onCommitEdit(draft)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") onCommitEdit(null);
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onCommitEdit(draft);
          }}
          className="h-28 w-full resize-none bg-transparent font-hand text-xl leading-tight text-[#2b2116] outline-none"
        />
      ) : (
        <p className="min-h-12 whitespace-pre-wrap break-words font-hand text-xl leading-tight text-[#2b2116]">{note.text || "..."}</p>
      )}
      {author && <p className="mt-1 text-right text-[10px] text-[#2b2116]/50">- {author}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export function Board({ source, className }: { source: BoardSource; className?: string }) {
  const ink = useInk(source.scope);
  const [tool, setTool] = useState<Tool>("move");
  const [color, setColor] = useState(INK_COLORS[0]);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [size, setSize] = useState(4);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fit, setFit] = useState(0.6);
  const [menu, setMenu] = useState<null | "suspect" | "clue">(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [eraserAt, setEraserAt] = useState<[number, number] | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<null | { mode: "draw"; id: string } | { mode: "erase"; began: boolean }>(null);
  const dragStart = useRef<{ id: string; px: number; py: number; x: number; y: number; moved: boolean } | null>(null);

  const scale = zoom === "fit" ? fit : zoom;
  const eraserR = size * 3 + 8;

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.max(0.25, Math.min(1.2, (el.clientWidth - 2) / BOARD_W, (el.clientHeight - 2) / BOARD_H))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toBoard = useCallback(
    (e: { clientX: number; clientY: number }): [number, number] => {
      const r = boardRef.current!.getBoundingClientRect();
      return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
    },
    [scale],
  );

  /** A spot in the middle of what's currently visible, for new pins. */
  const visibleSpot = () => {
    const el = viewport.current;
    const jitter = () => Math.round((Math.random() - 0.5) * 40);
    if (!el) return { x: 200, y: 200 };
    // Lay new pins out in a loose grid around the middle of the view so they don't stack.
    const n = source.notes.length;
    const x = (el.scrollLeft + el.clientWidth / 2) / scale - 420 + (n % 4) * 220 + jitter();
    const y = (el.scrollTop + el.clientHeight / 2) / scale - 300 + (Math.floor(n / 4) % 3) * 240 + jitter();
    return { x: Math.round(Math.max(10, Math.min(BOARD_W - 220, x))), y: Math.round(Math.max(10, Math.min(BOARD_H - 220, y))) };
  };

  // --- ink gestures -------------------------------------------------------

  function onInkDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const [x, y] = toBoard(e);
    // Keep focus where we put it (the text box, or the board for shortcuts).
    e.preventDefault();
    if (tool === "text") {
      if (textDraft?.value.trim()) commitText();
      setTextDraft({ x, y, value: "" });
      return;
    }
    rootRef.current?.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "eraser") {
      gesture.current = { mode: "erase", began: false };
      eraseStep(x, y);
      return;
    }
    if (tool === "pen" || tool === "highlighter" || tool === "string") {
      const s: Stroke = { id: newId(), tool, color, size, points: tool === "string" ? [x, y, x, y] : [x, y] };
      gesture.current = { mode: "draw", id: s.id };
      ink.begin();
      ink.update([...ink.current.current, s]);
    }
  }

  function eraseStep(x: number, y: number) {
    const g = gesture.current;
    if (!g || g.mode !== "erase") return;
    const next = eraseAt(ink.current.current, x, y, eraserR);
    if (!next) return;
    if (!g.began) {
      ink.begin();
      g.began = true;
    }
    ink.update(next);
  }

  function onInkMove(e: React.PointerEvent<SVGSVGElement>) {
    const [x, y] = toBoard(e);
    if (tool === "eraser") setEraserAt([x, y]);
    const g = gesture.current;
    if (!g) return;
    if (g.mode === "erase") return eraseStep(x, y);
    const list = ink.current.current;
    const last = list[list.length - 1];
    if (!last || last.id !== g.id) return;
    const points = last.tool === "string" ? [last.points[0], last.points[1], x, y] : addPoint(last.points, x, y);
    if (points === last.points) return;
    ink.update([...list.slice(0, -1), { ...last, points }]);
  }

  function onInkUp() {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === "erase" && !g.began) return;
    ink.end();
  }

  function commitText() {
    if (textDraft && textDraft.value.trim()) {
      ink.commit([...ink.current.current, { id: newId(), tool: "text", color, size, points: [textDraft.x, textDraft.y], text: textDraft.value.trim() }]);
    }
    setTextDraft(null);
  }

  // --- pinned items -------------------------------------------------------

  function onBoardDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool !== "note" || e.target !== e.currentTarget) return;
    e.preventDefault();
    if (noteDraft?.value.trim()) commitNoteDraft();
    const [x, y] = toBoard(e);
    setNoteDraft({ x: Math.min(BOARD_W - 190, x), y: Math.min(BOARD_H - 160, y), value: "" });
  }

  function commitNoteDraft() {
    if (noteDraft?.value.trim()) {
      source.add({ kind: "note", refId: null, text: noteDraft.value.trim(), x: Math.round(noteDraft.x), y: Math.round(noteDraft.y), color: noteColor }).catch(() => {});
    }
    setNoteDraft(null);
  }

  function onPinDown(e: React.PointerEvent<HTMLDivElement>, n: NoteItem) {
    if (tool !== "move" || editingId === n.id) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { id: n.id, px: e.clientX, py: e.clientY, x: n.x, y: n.y, moved: false };
  }

  function onPinMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragStart.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / scale;
    const dy = (e.clientY - d.py) / scale;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    setDrag({ id: d.id, x: Math.max(0, Math.min(BOARD_W - 160, d.x + dx)), y: Math.max(0, Math.min(BOARD_H - 120, d.y + dy)) });
  }

  function onPinUp() {
    const d = dragStart.current;
    dragStart.current = null;
    if (d?.moved && drag) source.move(drag.id, Math.round(drag.x), Math.round(drag.y));
    setDrag(null);
  }

  // --- keyboard -----------------------------------------------------------

  function onKeyDown(e: React.KeyboardEvent) {
    const typing = (e.target as HTMLElement).closest("input, textarea, select");
    if (typing) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") {
      e.preventDefault();
      if (e.shiftKey) ink.redo();
      else ink.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === "y") {
      e.preventDefault();
      ink.redo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = TOOLS.find((x) => x.key.toLowerCase() === k);
    if (t) setTool(t.id);
  }

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 2500);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const notes = useMemo(() => {
    const list = source.notes.map((n) => (drag && n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n));
    if (drag) list.sort((a, b) => (a.id === drag.id ? 1 : b.id === drag.id ? -1 : 0));
    return list;
  }, [source.notes, drag]);

  const inkActive = tool === "pen" || tool === "highlighter" || tool === "string" || tool === "text" || tool === "eraser";
  const showColors = tool !== "move" && tool !== "eraser";
  const pinnedSuspects = new Set(source.notes.filter((n) => n.kind === "suspect").map((n) => n.refId));
  const pinnedClues = new Set(source.notes.filter((n) => n.kind === "clue").map((n) => n.refId));
  const cursor =
    tool === "move" ? "default" : tool === "text" ? "text" : tool === "eraser" ? "none" : tool === "note" ? "copy" : "crosshair";

  return (
    <div ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown} className={cx("flex min-h-0 flex-col outline-none", className)}>
      {/* Toolbar */}
      <div className="relative z-20 flex flex-wrap items-center gap-1.5 border-b border-ink-700/80 bg-ink-900/95 px-2 py-2">
        <div className="flex items-center gap-0.5 rounded-xl bg-ink-850 p-1">
          {TOOLS.map((t) => (
            <ToolButton key={t.id} active={tool === t.id} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
              {icons[t.id]}
            </ToolButton>
          ))}
        </div>

        {showColors && (
          <div className="flex items-center gap-1 rounded-xl bg-ink-850 px-2 py-1.5">
            {(tool === "note" ? NOTE_COLORS : INK_COLORS).map((c) => {
              const active = tool === "note" ? noteColor === c : color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => (tool === "note" ? setNoteColor(c) : setColor(c))}
                  className={cx("h-6 w-6 rounded-full border border-black/40 transition", active ? "scale-110 ring-2 ring-clue-400 ring-offset-2 ring-offset-ink-850" : "hover:scale-110")}
                  style={{ background: c }}
                  aria-label={`Colour ${c}`}
                />
              );
            })}
          </div>
        )}

        {(tool === "pen" || tool === "highlighter" || tool === "string" || tool === "text" || tool === "eraser") && (
          <div className="flex items-center gap-1 rounded-xl bg-ink-850 px-1.5 py-1" aria-label="Size">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={cx("grid h-7 w-7 place-items-center rounded-lg", size === s ? "bg-ink-600" : "hover:bg-ink-700")}
                aria-label={`Size ${s}`}
              >
                <span className="rounded-full bg-ink-100" style={{ width: s + 2, height: s + 2 }} />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-0.5 rounded-xl bg-ink-850 p-1">
          <ToolButton onClick={ink.undo} title="Undo (Ctrl+Z)" disabled={!ink.canUndo}>
            {icons.undo}
          </ToolButton>
          <ToolButton onClick={ink.redo} title="Redo (Ctrl+Shift+Z)" disabled={!ink.canRedo}>
            {icons.redo}
          </ToolButton>
          <button
            type="button"
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true);
              ink.commit([]);
              setConfirmClear(false);
            }}
            disabled={ink.strokes.length === 0}
            className={cx(
              "flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition disabled:opacity-30",
              confirmClear ? "bg-blood-500 text-white" : "text-ink-100 hover:bg-ink-700",
            )}
            title="Erase all drawings"
          >
            {icons.trash}
            {confirmClear ? "Sure?" : <span className="hidden sm:inline">Clear ink</span>}
          </button>
        </div>

        {source.shared && (
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenu(menu === "suspect" ? null : "suspect")}
              disabled={source.suspects.length === 0}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-ink-850 px-2.5 text-xs font-semibold hover:bg-ink-700 disabled:opacity-40"
            >
              {icons.user} Pin suspect
            </button>
            <button
              type="button"
              onClick={() => setMenu(menu === "clue" ? null : "clue")}
              disabled={source.clues.length === 0}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-ink-850 px-2.5 text-xs font-semibold hover:bg-ink-700 disabled:opacity-40"
            >
              {icons.file} Pin evidence
            </button>
            <AnimatePresence>
              {menu && (
                <motion.ul
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="scrollbar-thin absolute left-0 top-11 z-30 max-h-80 w-72 overflow-y-auto rounded-xl border border-ink-600 bg-ink-850 p-1.5 shadow-2xl"
                >
                  {menu === "suspect"
                    ? source.suspects.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            disabled={pinnedSuspects.has(s.id)}
                            onClick={() => {
                              source.add({ kind: "suspect", refId: s.id, text: "", color: "#f7f4ee", ...visibleSpot() }).catch(() => {});
                              setMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-sm hover:bg-ink-700 disabled:opacity-40"
                          >
                            <span className="overflow-hidden rounded-full bg-ink-700">
                              <Portrait seed={suspectSeed(s, source.theme)} crop="head" size={34} expression={baselineExpression(s.stress)} />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{s.name}</span>
                            {pinnedSuspects.has(s.id) && <span className="text-[10px] text-ink-400">pinned</span>}
                          </button>
                        </li>
                      ))
                    : source.clues.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            disabled={pinnedClues.has(c.id)}
                            onClick={() => {
                              source.add({ kind: "clue", refId: c.id, text: c.text, color: "#f4ead2", ...visibleSpot() }).catch(() => {});
                              setMenu(null);
                            }}
                            className="w-full rounded-lg p-2 text-left text-xs hover:bg-ink-700 disabled:opacity-40"
                          >
                            <span className="font-mono text-clue-400">{c.id}</span> <span className="line-clamp-2">{c.text}</span>
                          </button>
                        </li>
                      ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="ml-auto flex items-center gap-0.5 rounded-xl bg-ink-850 p-1">
          <ToolButton onClick={() => setZoom(Math.max(0.3, +(scale - 0.15).toFixed(2)))} title="Zoom out">
            {icons.minus}
          </ToolButton>
          <button type="button" onClick={() => setZoom("fit")} className="h-9 min-w-12 rounded-lg px-1.5 font-mono text-xs hover:bg-ink-700" title="Fit to screen">
            {Math.round(scale * 100)}%
          </button>
          <ToolButton onClick={() => setZoom(Math.min(2, +(scale + 0.15).toFixed(2)))} title="Zoom in">
            {icons.plus}
          </ToolButton>
        </div>
      </div>

      {/* Surface */}
      <div ref={viewport} className="scrollbar-thin relative min-h-0 flex-1 overflow-auto bg-[#1a120c]" onPointerDown={() => setMenu(null)}>
        <div style={{ width: BOARD_W * scale, height: BOARD_H * scale }} className="relative">
          <div
            ref={boardRef}
            className="corkboard absolute left-0 top-0 origin-top-left shadow-[inset_0_0_0_10px_#4a2f1a,inset_0_0_70px_rgb(0_0_0/0.65)]"
            style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, cursor, touchAction: inkActive ? "none" : "auto" }}
            onPointerDown={onBoardDown}
          >
            {source.notes.length === 0 && ink.strokes.length === 0 && !noteDraft && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="max-w-lg text-center font-hand text-3xl leading-snug text-[#f4ead2]/55">
                  {source.shared
                    ? "Pin suspects and evidence, stick notes, and draw red string between them. Pins are shared with the room; your ink is yours."
                    : "Your detective board. Grab the pen, stick a note, connect the dots with red string. Everything here stays on this device."}
                </div>
              </div>
            )}

            {notes.map((n) => (
              <motion.div
                key={n.id}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: drag?.id === n.id ? 1.05 : 1, opacity: 1 }}
                className={cx("group absolute select-none", tool === "move" && "cursor-grab active:cursor-grabbing")}
                style={{ left: n.x, top: n.y, zIndex: drag?.id === n.id ? 15 : 1, touchAction: tool === "move" ? "none" : undefined }}
                onPointerDown={(e) => onPinDown(e, n)}
                onPointerMove={onPinMove}
                onPointerUp={onPinUp}
                onPointerCancel={onPinUp}
              >
                <span className="absolute -top-2 left-1/2 z-10 h-4 w-4 -translate-x-1/2 rounded-full bg-gradient-to-br from-red-400 to-red-700 shadow-[0_2px_4px_rgb(0_0_0/0.6)]" />
                <NoteCard
                  note={n}
                  source={source}
                  editing={editingId === n.id}
                  onEdit={() => n.kind === "note" && setEditingId(n.id)}
                  onCommitEdit={(text) => {
                    setEditingId(null);
                    if (text !== null && text.trim() && text.trim() !== n.text) source.edit(n, text.trim()).catch(() => {});
                  }}
                />
                {tool === "move" && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => source.remove(n.id)}
                    className="absolute -right-2.5 -top-2.5 z-20 hidden h-6 w-6 place-items-center rounded-full bg-ink-900 text-xs text-ink-100 shadow group-hover:grid"
                    aria-label="Remove from board"
                  >
                    ✕
                  </button>
                )}
              </motion.div>
            ))}

            {noteDraft && (
              <div className="absolute z-20 w-[176px] p-3 pt-5 shadow-2xl" style={{ left: noteDraft.x, top: noteDraft.y, background: noteColor }}>
                <textarea
                  autoFocus
                  value={noteDraft.value}
                  maxLength={200}
                  placeholder="Write a note..."
                  onChange={(e) => setNoteDraft({ ...noteDraft, value: e.target.value })}
                  onBlur={commitNoteDraft}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") setNoteDraft(null);
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitNoteDraft();
                  }}
                  className="h-28 w-full resize-none bg-transparent font-hand text-xl leading-tight text-[#2b2116] outline-none placeholder:text-[#2b2116]/40"
                />
              </div>
            )}

            {/* Ink layer, on top of the pins so you can circle and underline them. */}
            <svg
              className="absolute inset-0 z-10"
              width={BOARD_W}
              height={BOARD_H}
              style={{ pointerEvents: inkActive ? "auto" : "none" }}
              onPointerDown={onInkDown}
              onPointerMove={onInkMove}
              onPointerUp={onInkUp}
              onPointerCancel={onInkUp}
              onPointerLeave={() => setEraserAt(null)}
            >
              <defs>
                <filter id="ink-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="1" dy="3" stdDeviation="2" floodOpacity="0.5" />
                </filter>
              </defs>
              {ink.strokes.map((s) => {
                if (s.tool === "text") {
                  return (
                    <text key={s.id} x={s.points[0]} y={s.points[1]} fill={s.color} fontSize={textFontSize(s)} className="font-hand" style={{ fontFamily: "var(--font-hand)" }}>
                      {s.text}
                    </text>
                  );
                }
                if (s.tool === "string") {
                  const [x1, y1, x2, y2] = s.points;
                  return (
                    <g key={s.id} filter="url(#ink-shadow)">
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={s.color} strokeWidth={s.size + 1} strokeLinecap="round" />
                      <circle cx={x1} cy={y1} r={6} fill="#b91c1c" stroke="#00000066" />
                      <circle cx={x2} cy={y2} r={6} fill="#b91c1c" stroke="#00000066" />
                    </g>
                  );
                }
                return (
                  <path
                    key={s.id}
                    d={pathOf(s.points)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.tool === "highlighter" ? s.size * 4 + 6 : s.size}
                    strokeOpacity={s.tool === "highlighter" ? 0.35 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
              {tool === "eraser" && eraserAt && (
                <circle cx={eraserAt[0]} cy={eraserAt[1]} r={eraserR} fill="#ffffff22" stroke="#ffffffaa" strokeDasharray="4 3" pointerEvents="none" />
              )}
            </svg>

            {textDraft && (
              <input
                autoFocus
                value={textDraft.value}
                onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                onBlur={commitText}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commitText();
                  if (e.key === "Escape") setTextDraft(null);
                }}
                placeholder="Type, then Enter"
                className="absolute z-20 min-w-48 border-b-2 border-dashed border-current bg-black/20 px-1 font-hand outline-none"
                style={{
                  left: textDraft.x,
                  top: textDraft.y - textFontSize({ size } as Stroke),
                  color,
                  fontSize: textFontSize({ size } as Stroke),
                  fontFamily: "var(--font-hand)",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
