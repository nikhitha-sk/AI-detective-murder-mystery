"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { create } from "zustand";
import { sfx } from "@/lib/sfx";

/**
 * Ace Attorney-style shout: a jagged speech burst slams onto the screen with a
 * flash and a shake. Fired when a detective presents evidence, presses or
 * accuses, so the big moments feel big.
 */

export type BurstKind = "take-that" | "hold-it" | "objection" | "gotcha";

const TEXT: Record<BurstKind, string> = {
  "take-that": "TAKE THAT!",
  "hold-it": "HOLD IT!",
  objection: "OBJECTION!",
  gotcha: "GOTCHA!",
};

const COLORS: Record<BurstKind, { fill: string; text: string }> = {
  "take-that": { fill: "#f5b83d", text: "#2a0b0b" },
  "hold-it": { fill: "#60a5fa", text: "#0b1530" },
  objection: { fill: "#dc2626", text: "#ffffff" },
  gotcha: { fill: "#dc2626", text: "#ffffff" },
};

interface BurstState {
  current: { kind: BurstKind; key: number } | null;
  fire(kind: BurstKind): void;
  clear(): void;
}

export const useBurst = create<BurstState>()((set) => ({
  current: null,
  fire(kind) {
    sfx.objection();
    set({ current: { kind, key: Date.now() } });
  },
  clear: () => set({ current: null }),
}));

/** 16-point star polygon, slightly irregular so it reads as hand-drawn. */
const STAR = Array.from({ length: 32 }, (_, i) => {
  const angle = (i / 32) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 === 0 ? 50 - (i % 6) * 1.5 : 34 + (i % 5) * 1.2;
  return `${50 + Math.cos(angle) * r * 1.9},${50 + Math.sin(angle) * r}`;
}).join(" ");

export function BurstOverlay() {
  const current = useBurst((s) => s.current);
  const clear = useBurst((s) => s.clear);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(clear, 1100);
    return () => clearTimeout(t);
  }, [current, clear]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.key}
          className="pointer-events-none fixed inset-0 z-[70] grid place-items-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          aria-live="assertive"
        >
          <motion.div className="absolute inset-0 bg-white" initial={{ opacity: reduce ? 0 : 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
          {/* Speed lines */}
          <motion.div
            className="absolute inset-0"
            style={{ background: "repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 255 255 / 0.10) 0deg 3deg, transparent 3deg 12deg)" }}
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            initial={{ scale: reduce ? 1 : 2.6, rotate: -14, opacity: 0 }}
            animate={reduce ? { opacity: 1, rotate: -6 } : { scale: [2.6, 0.92, 1.04, 1], rotate: -6, opacity: 1, x: [0, -10, 9, -6, 4, 0] }}
            transition={{ duration: 0.45, times: [0, 0.45, 0.7, 1] }}
            className="relative w-[min(640px,92vw)]"
          >
            <svg viewBox="-45 -5 190 110" className="w-full drop-shadow-[0_12px_30px_rgb(0_0_0/0.6)]">
              <polygon points={STAR} fill="#111" transform="translate(2 3)" />
              <polygon points={STAR} fill={COLORS[current.kind].fill} stroke="#111" strokeWidth="2.5" strokeLinejoin="round" />
              <text
                x="50"
                y="58"
                textAnchor="middle"
                fontFamily="var(--font-playfair), Georgia, serif"
                fontWeight="900"
                fontStyle="italic"
                fontSize={TEXT[current.kind].length > 9 ? 21 : 24}
                fill={COLORS[current.kind].text}
                stroke="#111"
                strokeWidth="0.6"
                letterSpacing="0.5"
              >
                {TEXT[current.kind]}
              </text>
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
