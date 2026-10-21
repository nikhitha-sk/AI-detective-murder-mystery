"use client";

import { isBuiltInTheme, type Theme } from "@mystery/shared";
import { motion } from "framer-motion";
import { sfx } from "@/lib/sfx";
import { Scene } from "./Scene";
import { Spinner, cx } from "./ui";

/** Setting cards with a live miniature of each scene, and a card at the end that asks the AI for more. */
export function ThemePicker({
  themes,
  value,
  onChange,
  disabled,
  onGenerate,
  generating,
}: {
  themes: Theme[];
  value: string;
  onChange: (theme: Theme) => void;
  disabled?: boolean;
  /** Shows the "generate new settings" card when set. */
  onGenerate?: () => void;
  generating?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {themes.map((t, i) => {
        const active = value === t.id;
        const generated = !isBuiltInTheme(t.id);
        return (
          <motion.button
            key={t.id}
            type="button"
            disabled={disabled}
            initial={generated ? { opacity: 0, y: 12, scale: 0.97 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: generated ? Math.min(i, 3) * 0.05 : 0 }}
            whileHover={disabled ? undefined : { y: -4 }}
            onClick={() => {
              sfx.click();
              onChange(t);
            }}
            className={cx(
              "group overflow-hidden rounded-xl border-2 text-left transition disabled:cursor-default",
              active ? "border-clue-400 shadow-[0_0_24px_rgb(245_184_61/0.25)]" : "border-ink-700 hover:border-ink-600",
            )}
          >
            <Scene theme={t.id} variant="thumb" className="h-24">
              {generated && (
                <span className="absolute left-2 top-2 rounded bg-ink-950/80 px-1.5 text-[10px] font-bold tracking-wider text-clue-300">AI</span>
              )}
              {active && <span className="absolute right-2 top-2 rounded bg-clue-400 px-1.5 text-[10px] font-bold text-ink-950">SELECTED</span>}
            </Scene>
            <span className="block bg-ink-850 p-3">
              <span className="font-display text-lg font-bold">{t.label}</span>
              <span className="mt-0.5 block text-xs text-ink-300">{t.blurb}</span>
            </span>
          </motion.button>
        );
      })}

      {onGenerate && (
        <motion.button
          type="button"
          disabled={disabled || generating}
          whileHover={disabled || generating ? undefined : { y: -4 }}
          onClick={() => {
            sfx.click();
            onGenerate();
          }}
          className="flex min-h-[172px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-clue-400/50 bg-clue-900/10 p-4 text-center transition hover:border-clue-400 hover:bg-clue-900/25 disabled:cursor-wait disabled:opacity-80"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-clue-400/15 text-2xl text-clue-300">
            {generating ? <Spinner /> : "✦"}
          </span>
          <span className="font-display text-lg font-bold text-clue-300">{generating ? "Inventing new settings..." : "Generate new settings"}</span>
          <span className="text-xs text-ink-300">
            {generating ? "The AI is dreaming up fresh places for a murder." : "The AI invents 3 brand-new places for a murder. Every case is written fresh."}
          </span>
        </motion.button>
      )}
    </div>
  );
}
