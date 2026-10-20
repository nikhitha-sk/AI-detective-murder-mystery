"use client";

import type { Phase } from "@mystery/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { useGame } from "@/store/game";

const TITLES: Record<Phase, { kicker: string; title: string; sub: string }> = {
  lobby: { kicker: "Back at headquarters", title: "The Lobby", sub: "Pick a setting and start a new case" },
  generating: { kicker: "Stand by", title: "A Crime Is Written", sub: "The case file is being prepared" },
  briefing: { kicker: "Chapter one", title: "The Briefing", sub: "Read the case file. Meet the suspects." },
  interrogation: { kicker: "", title: "Interrogation", sub: "Question the suspects. Present the evidence." },
  discussion: { kicker: "Lights up", title: "Compare Notes", sub: "Share what you learned before the vote" },
  voting: { kicker: "The moment of truth", title: "The Accusation", sub: "One vote each. Choose carefully." },
  reveal: { kicker: "Case closed", title: "The Reveal", sub: "The sealed envelope is opened" },
};

/** Full-screen title card when the game moves to a new phase or round. */
export function PhaseBanner() {
  const phase = useGame((s) => s.view?.phase);
  const round = useGame((s) => s.view?.round ?? 0);
  const total = useGame((s) => s.view?.totalRounds ?? 3);
  const [shown, setShown] = useState<{ key: string; phase: Phase; round: number } | null>(null);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!phase) return;
    const key = `${phase}-${round}`;
    // Skip the phase the player joined in; only announce changes.
    if (last.current === null) {
      last.current = key;
      return;
    }
    if (last.current === key) return;
    last.current = key;
    setShown({ key, phase, round });
    sfx.phase();
    const t = setTimeout(() => setShown(null), 2300);
    return () => clearTimeout(t);
  }, [phase, round]);

  const info = shown ? TITLES[shown.phase] : null;
  return (
    <AnimatePresence>
      {shown && info && (
        <motion.div
          key={shown.key}
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-[2px]" />
          <motion.div
            className="absolute inset-x-0 top-1/2 h-48 -translate-y-1/2 bg-gradient-to-r from-transparent via-blood-900/80 to-transparent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          />
          <div className="relative text-center">
            <motion.p
              className="font-type text-sm uppercase tracking-[0.5em] text-clue-300"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {shown.phase === "interrogation" ? `Round ${shown.round} of ${total}` : info.kicker}
            </motion.p>
            <motion.h2
              className="mt-2 font-display text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_30px_rgb(220_38_38/0.6)] sm:text-8xl"
              initial={{ opacity: 0, scale: 1.4, letterSpacing: "0.3em" }}
              animate={{ opacity: 1, scale: 1, letterSpacing: "0em" }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {info.title}
            </motion.h2>
            <motion.p className="mt-3 text-ink-300" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              {info.sub}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
