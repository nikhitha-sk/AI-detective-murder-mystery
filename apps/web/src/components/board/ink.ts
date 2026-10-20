"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Freehand ink on the detective board. Kept per browser (localStorage), one layer per room. */

export type InkTool = "pen" | "highlighter" | "string" | "text";

export interface Stroke {
  id: string;
  tool: InkTool;
  color: string;
  size: number;
  /** Flat [x0, y0, x1, y1, ...] in board units. */
  points: number[];
  text?: string;
}

const HISTORY = 60;
const key = (scope: string) => `ai-detective:ink:${scope}`;

export const newId = () => Math.random().toString(36).slice(2, 10);

function load(scope: string): Stroke[] {
  try {
    const raw = localStorage.getItem(key(scope));
    return raw ? (JSON.parse(raw) as Stroke[]) : [];
  } catch {
    return [];
  }
}

function save(scope: string, strokes: Stroke[]) {
  try {
    localStorage.setItem(key(scope), JSON.stringify(strokes));
  } catch {
    /* storage full or blocked: ink lasts for this session only */
  }
}

export function textFontSize(s: Stroke) {
  return 14 + s.size * 4;
}

/** Smooth path through the points using quadratic midpoints. */
export function pathOf(p: number[]): string {
  if (p.length < 4) return `M${p[0]},${p[1]} l0.01,0`;
  let d = `M${p[0]},${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2;
    const my = (p[i + 1] + p[i + 3]) / 2;
    d += ` Q${p[i]},${p[i + 1]} ${mx},${my}`;
  }
  return `${d} L${p[p.length - 2]},${p[p.length - 1]}`;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Erase around (x, y). Pen and highlighter strokes are cut where the eraser
 * touches them; strings and text are removed whole. Returns null if nothing changed.
 */
export function eraseAt(strokes: Stroke[], x: number, y: number, r: number): Stroke[] | null {
  let changed = false;
  const out: Stroke[] = [];
  for (const s of strokes) {
    const reach = r + (s.tool === "highlighter" ? s.size * 2 : s.size / 2);
    if (s.tool === "text") {
      const fs = textFontSize(s);
      const w = (s.text?.length ?? 0) * fs * 0.55;
      const [tx, ty] = s.points;
      const hit = x >= tx - r && x <= tx + w + r && y >= ty - fs - r && y <= ty + fs * 0.3 + r;
      if (hit) changed = true;
      else out.push(s);
      continue;
    }
    if (s.tool === "string") {
      const [x1, y1, x2, y2] = s.points;
      if (distToSegment(x, y, x1, y1, x2, y2) <= reach) changed = true;
      else out.push(s);
      continue;
    }
    let run: number[] = [];
    const runs: number[][] = [];
    let cut = false;
    for (let i = 0; i < s.points.length; i += 2) {
      const px = s.points[i];
      const py = s.points[i + 1];
      if (Math.hypot(px - x, py - y) <= reach) {
        cut = true;
        if (run.length) runs.push(run);
        run = [];
      } else run.push(px, py);
    }
    if (run.length) runs.push(run);
    if (!cut) {
      out.push(s);
      continue;
    }
    changed = true;
    for (const pts of runs) if (pts.length >= 4) out.push({ ...s, id: newId(), points: pts });
  }
  return changed ? out : null;
}

/** Add a point, filling gaps so the eraser can cut precisely. */
export function addPoint(points: number[], x: number, y: number, step = 5): number[] {
  const n = points.length;
  if (n < 2) return [x, y];
  const lx = points[n - 2];
  const ly = points[n - 1];
  const d = Math.hypot(x - lx, y - ly);
  if (d < 1.5) return points;
  const out = points.slice();
  const segs = Math.floor(d / step);
  for (let i = 1; i < segs; i++) out.push(lx + ((x - lx) * i) / segs, ly + ((y - ly) * i) / segs);
  out.push(x, y);
  return out;
}

export function useInk(scope: string) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const undoStack = useRef<Stroke[][]>([]);
  const redoStack = useRef<Stroke[][]>([]);
  const current = useRef<Stroke[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    const loaded = load(scope);
    current.current = loaded;
    setStrokes(loaded);
    undoStack.current = [];
    redoStack.current = [];
  }, [scope]);

  /** Start an undoable change (call once per gesture). */
  const begin = useCallback(() => {
    undoStack.current = [...undoStack.current.slice(-HISTORY + 1), current.current];
    redoStack.current = [];
  }, []);

  /** Live update during a gesture. */
  const update = useCallback((next: Stroke[]) => {
    current.current = next;
    setStrokes(next);
  }, []);

  /** Finish a gesture and persist. */
  const end = useCallback(() => {
    save(scope, current.current);
    bump((n) => n + 1);
  }, [scope]);

  const commit = useCallback(
    (next: Stroke[]) => {
      begin();
      update(next);
      end();
    },
    [begin, update, end],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(current.current);
    update(prev);
    end();
  }, [update, end]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(current.current);
    update(next);
    end();
  }, [update, end]);

  return {
    strokes,
    current,
    begin,
    update,
    end,
    commit,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
