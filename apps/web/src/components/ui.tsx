"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Expression } from "@/lib/expression";
import { sfx } from "@/lib/sfx";
import { useGame } from "@/store/game";
import { Portrait, suspectSeed } from "./Portrait";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "danger" | "clue";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: "bg-plum-600 hover:bg-plum-500 text-white shadow-lg shadow-plum-700/30",
    ghost: "bg-ink-800 hover:bg-ink-700 text-ink-100 border border-ink-700",
    danger: "bg-blood-500 hover:bg-blood-400 text-white",
    clue: "bg-clue-400 hover:bg-clue-300 text-ink-950",
  };
  return (
    <button
      {...props}
      className={cx(
        "game-btn inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum-400",
        styles[variant],
        className,
      )}
    />
  );
}

export function Panel({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-ink-700/80 bg-ink-900/80 backdrop-blur", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-ink-700/80 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const HUES = ["#a78bfa", "#f5b83d", "#4ade80", "#f472b6", "#60a5fa", "#fb923c"];

export function suspectColor(id: string) {
  const n = Number(id.replace(/\D/g, "")) || 0;
  return HUES[(n - 1 + HUES.length) % HUES.length];
}

export function Avatar({
  id,
  name,
  role,
  size = 40,
  dim,
  expression = "neutral",
  className,
}: {
  id: string;
  name: string;
  role?: string;
  size?: number;
  dim?: boolean;
  expression?: Expression;
  className?: string;
}) {
  const theme = useGame((s) => s.view?.theme);
  const known = useGame((s) => s.view?.case?.suspects.find((x) => x.id === id));
  const color = suspectColor(id);
  return (
    <div
      className={cx("shrink-0 overflow-hidden rounded-full", dim && "opacity-60 grayscale", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 35%, ${color}66, #15111c 78%)`,
        boxShadow: `0 0 0 2px #0b0910, 0 0 0 3px ${color}88`,
      }}
    >
      <Portrait seed={suspectSeed({ id, name, role: role ?? known?.role, bio: known?.bio }, theme)} crop="head" size={size} expression={expression} />
    </div>
  );
}

export function StressMeter({ value, compact }: { value: number; compact?: boolean }) {
  const color = value >= 80 ? "bg-blood-500" : value >= 60 ? "bg-clue-400" : value >= 35 ? "bg-plum-400" : "bg-mint-400";
  const label = value >= 80 ? "breaking" : value >= 60 ? "rattled" : value >= 35 ? "uneasy" : "calm";
  return (
    <div className="w-full" title={`Nerves: ${value}/100`}>
      {!compact && (
        <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-ink-400">
          <span>nerves</span>
          <span>{label}</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <motion.div className={cx("h-full rounded-full", color)} animate={{ width: `${value}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
      </div>
    </div>
  );
}

/** Seconds left at which the timer starts ticking and pulsing. */
const URGENT_S = 10;

export function Countdown({ endsAt, ticking }: { endsAt: number | null; ticking?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (!ticking || !endsAt || left > URGENT_S || left === 0 || lastTick.current === left) return;
    lastTick.current = left;
    sfx.tick();
  }, [left, ticking, endsAt]);
  if (!endsAt) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const urgent = left <= URGENT_S;
  return (
    <motion.span
      key={urgent ? left : "calm"}
      initial={urgent ? { scale: 1.35 } : false}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className={cx("inline-block font-mono tabular-nums", urgent ? "font-bold text-blood-400" : left <= 30 ? "text-clue-300" : "text-ink-100")}
      aria-label={`${left} seconds left`}
    >
      {mm}:{ss}
    </motion.span>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            onClick={() => dismiss(t.id)}
            className={cx(
              "pointer-events-auto rounded-xl border px-4 py-3 text-left text-sm shadow-2xl backdrop-blur",
              t.tone === "error" && "border-blood-500/50 bg-blood-900/90 text-red-100",
              t.tone === "clue" && "border-clue-400/50 bg-clue-900/95 font-type text-clue-300",
              t.tone === "info" && "border-ink-600 bg-ink-800/95 text-ink-100",
            )}
          >
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-hidden
    />
  );
}
