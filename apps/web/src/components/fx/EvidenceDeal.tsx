"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";
import { useGame } from "@/store/game";
import { Button } from "../ui";

/** Wait this long before dealing, so the round's title card (PhaseBanner) plays first. */
const AFTER_BANNER_MS = 2400;

/**
 * New evidence is dealt face down onto the table and flipped one by one, like
 * cards in a game, instead of arriving as a list of toasts.
 */
export function EvidenceDeal() {
  const dealt = useGame((s) => s.dealt);
  const clear = useGame((s) => s.clearDealt);
  const round = useGame((s) => s.view?.round ?? 0);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!dealt.length) return;
    const t = setTimeout(() => {
      setOpen(true);
      sfx.clue();
      dealt.forEach((_, i) => setTimeout(() => sfx.deal(), 250 + i * 260));
    }, AFTER_BANNER_MS);
    return () => clearTimeout(t);
  }, [dealt]);

  const close = () => {
    sfx.click();
    setOpen(false);
    clear();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        setOpen(false);
        clear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, clear]);

  return (
    <AnimatePresence>
      {open && dealt.length > 0 && (
        <motion.div
          className="fixed inset-0 z-[65] flex flex-col items-center justify-center bg-ink-950/85 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          role="dialog"
          aria-label="New evidence"
        >
          <motion.p
            className="font-type text-xs uppercase tracking-[0.5em] text-clue-300"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Round {round} · new evidence
          </motion.p>
          <motion.h2
            className="mt-2 font-display text-4xl font-extrabold sm:text-5xl"
            initial={{ opacity: 0, scale: 1.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
          >
            {dealt.length === 1 ? "An exhibit surfaces" : `${dealt.length} exhibits surface`}
          </motion.h2>

          <div className="mt-8 flex max-w-5xl flex-wrap items-start justify-center gap-5" style={{ perspective: 1200 }}>
            {dealt.map((c, i) => (
              <motion.div
                key={c.id}
                className="relative h-[220px] w-[min(240px,80vw)]"
                initial={reduce ? { opacity: 0 } : { y: 260, rotate: -25 + i * 12, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { y: 0, rotate: (i - (dealt.length - 1) / 2) * 3, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.26, type: "spring", stiffness: 130, damping: 15 }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <motion.div
                  className="relative h-full w-full"
                  style={{ transformStyle: "preserve-3d" }}
                  initial={{ rotateY: reduce ? 0 : 180 }}
                  animate={{ rotateY: 0 }}
                  transition={{ delay: 0.55 + i * 0.26, duration: 0.6, ease: [0.3, 0.7, 0.2, 1] }}
                >
                  {/* Front */}
                  <div className="paper absolute inset-0 overflow-hidden rounded-md p-4 shadow-[0_20px_40px_rgb(0_0_0/0.6)]" style={{ backfaceVisibility: "hidden" }}>
                    <span className="absolute -top-1.5 right-6 h-6 w-3.5 rounded-sm bg-ink-400/70" aria-hidden />
                    <p className="font-type text-[11px] uppercase tracking-[0.25em] opacity-60">Exhibit {c.id}</p>
                    <p className="mt-2 font-type text-[14px] leading-snug">{c.text}</p>
                    <span className="stamp absolute bottom-3 right-3 rotate-[-8deg] text-xs font-bold text-blood-500 [mix-blend-mode:multiply]">New</span>
                  </div>
                  {/* Back */}
                  <div
                    className="absolute inset-0 grid place-items-center rounded-md border-4 border-[#5a3a1f] bg-gradient-to-br from-[#8a5a32] to-[#3b2414] shadow-[0_20px_40px_rgb(0_0_0/0.6)]"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <span className="stamp rotate-[-10deg] text-xl font-bold text-[#f4ead2]/80">Evidence</span>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + dealt.length * 0.26 }} className="mt-10 flex flex-col items-center gap-2">
            <Button variant="clue" className="px-8 py-3 text-base" onClick={close}>
              Add to the dossier
            </Button>
            <span className="text-xs text-ink-400">Enter or click anywhere to continue</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
