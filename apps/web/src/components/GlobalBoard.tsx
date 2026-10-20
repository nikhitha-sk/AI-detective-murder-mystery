"use client";

import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { useEffect } from "react";
import { setMuted, sfx, useMuted } from "@/lib/sfx";
import { useGame } from "@/store/game";
import { Board, icons } from "./board/Board";
import { useLocalBoard, useRoomBoard } from "./board/sources";
import { cx } from "./ui";

/** Whether the full-screen detective board is open. Any screen can open it. */
export const useBoardOverlay = create<{ open: boolean; setOpen(open: boolean): void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export function SoundToggle({ className }: { className?: string }) {
  const muted = useMuted();
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted);
        if (muted) sfx.click();
      }}
      className={cx("grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-850/80 text-ink-100 hover:border-ink-600", className)}
      title={muted ? "Sound off" : "Sound on"}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5L6 9H2v6h4l5 4z" />
        {muted ? <path d="M23 9l-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" />}
      </svg>
    </button>
  );
}

export function GlobalBoard() {
  const open = useBoardOverlay((s) => s.open);
  const setOpen = useBoardOverlay((s) => s.setOpen);
  const room = useRoomBoard();
  const local = useLocalBoard();
  const code = useGame((s) => s.code);
  const source = code && room ? room : local;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape" && open) setOpen(false);
      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.metaKey && !e.altKey && !open) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {!code && (
        <motion.button
          type="button"
          onClick={() => {
            sfx.click();
            setOpen(true);
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.06, rotate: -2 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border-2 border-[#6b4423] bg-gradient-to-b from-[#8a5a32] to-[#5a3a1f] py-2.5 pl-3 pr-4 text-sm font-bold text-[#f4ead2] shadow-[0_8px_24px_rgb(0_0_0/0.6)]"
          title="Open the detective board (B)"
        >
          {icons.board}
          <span className="hidden sm:inline">Detective board</span>
          <kbd className="hidden rounded bg-black/30 px-1.5 text-[10px] font-mono sm:inline">B</kbd>
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex min-h-0 flex-1 flex-col"
              initial={{ y: 30, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 30, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <header className="flex items-center gap-3 border-b border-ink-700 px-4 py-2.5">
                <span className="text-clue-400">{icons.board}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold leading-tight">Detective board</h2>
                  <p className="truncate text-xs text-ink-400">
                    {source.shared ? `Room ${code}: pins are shared with everyone, your drawings stay on your device` : "Personal scratch board, saved on this device"}
                  </p>
                </div>
                <SoundToggle />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm font-semibold hover:border-ink-600"
                >
                  Close <kbd className="ml-1 font-mono text-[10px] text-ink-400">Esc</kbd>
                </button>
              </header>
              <Board source={source} className="min-h-0 flex-1" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
