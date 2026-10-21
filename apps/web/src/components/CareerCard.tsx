"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BADGES, loadCareer, rankFor, type Career } from "@/lib/career";
import { cx } from "./ui";

/** The player's rank and record, from earlier cases in this browser. */
export function CareerCard({ className }: { className?: string }) {
  const [career, setCareer] = useState<Career | null>(null);
  useEffect(() => setCareer(loadCareer()), []);
  if (!career) return null;

  const { rank, next, progress } = rankFor(career.xp);
  const rate = career.cases ? Math.round((career.solved / career.cases) * 100) : 0;

  return (
    <div className={cx("rounded-xl border border-white/10 bg-gradient-to-br from-[#2a2010]/80 to-ink-900/80 p-3", className)}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#d4af37] to-[#7a5a14] text-xl shadow-[0_0_16px_rgb(212_175_55/0.35)]">
          {rank.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-display text-lg font-bold">{rank.title}</span>
            <span className="text-[11px] text-ink-400">{career.xp} XP</span>
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-clue-400 to-[#ffe9a8]"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-400">
            {career.cases === 0
              ? "Solve your first case to earn XP and rank up."
              : `${career.solved}/${career.cases} solved (${rate}%) · best streak ${career.bestStreak}${next ? ` · ${next.minXp - career.xp} XP to ${next.title}` : ""}`}
          </p>
        </div>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Badges">
        {Object.entries(BADGES).map(([id, b]) => {
          const count = career.badges[id] ?? 0;
          return (
            <li
              key={id}
              title={`${b.title}: ${b.description}${count ? ` (earned ${count}x)` : " (not earned yet)"}`}
              className={cx("relative grid h-8 w-8 place-items-center rounded-lg border text-base", count ? "border-clue-400/50 bg-clue-900/40" : "border-ink-700 bg-ink-850 opacity-40 grayscale")}
            >
              {b.icon}
              {count > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-clue-400 px-1 text-[9px] font-bold text-ink-950">{count}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
