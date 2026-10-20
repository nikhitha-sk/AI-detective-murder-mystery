"use client";

import { THEMES } from "@mystery/shared";
import { motion } from "framer-motion";
import { sfx } from "@/lib/sfx";
import { Scene } from "./Scene";
import { cx } from "./ui";

/** Setting cards with a live miniature of each scene. */
export function ThemePicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {THEMES.map((t) => {
        const active = value === t.id;
        return (
          <motion.button
            key={t.id}
            type="button"
            disabled={disabled}
            whileHover={disabled ? undefined : { y: -4 }}
            onClick={() => {
              sfx.click();
              onChange(t.id);
            }}
            className={cx(
              "group overflow-hidden rounded-xl border-2 text-left transition disabled:cursor-default",
              active ? "border-clue-400 shadow-[0_0_24px_rgb(245_184_61/0.25)]" : "border-ink-700 hover:border-ink-600",
            )}
          >
            <Scene theme={t.id} variant="thumb" className="h-24">
              {active && <span className="absolute right-2 top-2 rounded bg-clue-400 px-1.5 text-[10px] font-bold text-ink-950">SELECTED</span>}
            </Scene>
            <span className="block bg-ink-850 p-3">
              <span className="font-display text-lg font-bold">{t.label}</span>
              <span className="mt-0.5 block text-xs text-ink-300">{t.blurb}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
