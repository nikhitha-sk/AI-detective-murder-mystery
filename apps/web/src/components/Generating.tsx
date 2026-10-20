"use client";

import { motion } from "framer-motion";
import { useGame } from "@/store/game";
import { Portrait } from "./Portrait";
import { Scene } from "./Scene";

const STEPS = ["Writing the case file", "Checking the timeline and clues", "Testing it on an independent detective"];
const SHADOWS = ["a", "b", "c", "d", "e"];

export function Generating() {
  const g = useGame((s) => s.view!.generation);
  const theme = useGame((s) => s.view!.theme);
  const stepIndex = g.message.startsWith("An independent") ? 2 : g.message.startsWith("Checking") ? 1 : 0;

  return (
    <Scene theme={theme} variant="hero" className="mx-auto mt-4 max-w-4xl rounded-3xl border border-ink-700/80">
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <div className="flex items-end justify-center gap-1 sm:gap-3">
          {SHADOWS.map((id, i) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: [0.35, 0.8, 0.35], y: 0 }}
              transition={{ opacity: { repeat: Infinity, duration: 3, delay: i * 0.4 }, y: { delay: i * 0.15 } }}
              className="relative"
              style={{ filter: "brightness(0) drop-shadow(0 0 12px rgb(167 139 250 / 0.5))" }}
            >
              <Portrait seed={{ id: `shadow-${id}`, name: `Suspect ${id}`, theme }} size={110} className="h-auto w-[64px] sm:w-[110px]" />
              <span className="absolute inset-x-0 top-1/3 text-center font-display text-3xl font-bold text-white" style={{ filter: "invert(1)" }}>
                ?
              </span>
            </motion.div>
          ))}
        </div>

        <h1 className="mt-8 font-display text-3xl font-bold sm:text-4xl">A crime is being written...</h1>
        <ol className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          {STEPS.map((s, i) => (
            <motion.li key={s} animate={{ opacity: i <= stepIndex ? 1 : 0.45 }} className="flex items-center gap-2">
              <span className={i < stepIndex ? "text-mint-400" : i === stepIndex ? "text-clue-400" : "text-ink-400"}>
                {i < stepIndex ? "✓" : i === stepIndex ? <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>●</motion.span> : "○"}
              </span>
              <span className="font-type">{s}</span>
            </motion.li>
          ))}
        </ol>
        <p className="mt-6 max-w-md text-sm text-ink-300">
          Attempt {g.attempt} of {g.maxAttempts}. A case is only played if a separate solver can crack it from the clues alone.
        </p>
        <p className="mt-2 text-xs text-ink-400">Tip: press B to open your detective board while you wait.</p>
      </div>
    </Scene>
  );
}
