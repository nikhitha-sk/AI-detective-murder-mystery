"use client";

import { motion } from "framer-motion";
import { useGame } from "@/store/game";

const STEPS = ["Writing the case file", "Checking the timeline and clues", "Testing it on an independent detective"];

export function Generating() {
  const g = useGame((s) => s.view!.generation);
  const stepIndex = g.message.startsWith("An independent") ? 2 : g.message.startsWith("Checking") ? 1 : 0;

  return (
    <div className="mx-auto mt-10 max-w-xl text-center">
      <motion.div
        className="paper mx-auto w-64 rounded-sm p-6 shadow-2xl"
        animate={{ rotate: [-1.5, 1.5, -1.5] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      >
        <p className="font-type text-sm uppercase tracking-widest">Case file</p>
        <p className="mt-2 font-type text-3xl">CLASSIFIED</p>
        <div className="mt-4 space-y-2">
          {[80, 95, 60, 88].map((w, i) => (
            <motion.div
              key={i}
              className="h-2 rounded bg-[#2b2116]/70"
              initial={{ width: 0 }}
              animate={{ width: `${w}%` }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.6, delay: i * 0.3 }}
            />
          ))}
        </div>
      </motion.div>

      <h1 className="mt-10 font-display text-3xl font-bold">A crime is being written...</h1>
      <ol className="mx-auto mt-6 max-w-sm space-y-2 text-left">
        {STEPS.map((s, i) => (
          <li key={s} className={i <= stepIndex ? "text-ink-100" : "text-ink-400"}>
            <span className="mr-2 font-mono text-plum-400">{i < stepIndex ? "✓" : i === stepIndex ? "›" : "·"}</span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-ink-400">
        Attempt {g.attempt} of {g.maxAttempts}. A case is only played if a separate solver can crack it from the clues alone.
      </p>
    </div>
  );
}
