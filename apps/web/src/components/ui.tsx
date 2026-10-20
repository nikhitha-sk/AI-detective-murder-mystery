"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useGame } from "@/store/game";

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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
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

export function initials(name: string) {
  const parts = name.replace(/^(Lady|Lord|Doctor|Dr\.?|Mr\.?|Mrs\.?|Miss|Sir)\s+/i, "").split(/\s+/);
  return (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

export function Avatar({ id, name, size = 40, dim }: { id: string; name: string; size?: number; dim?: boolean }) {
  const color = suspectColor(id);
  return (
    <div
      className={cx("grid shrink-0 place-items-center rounded-full font-display font-bold text-ink-950", dim && "opacity-60")}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `radial-gradient(circle at 30% 25%, #fff6, transparent 55%), ${color}`,
        boxShadow: `0 0 0 2px #0b0910, 0 0 0 3px ${color}55`,
      }}
      aria-hidden
    >
      {initials(name)}
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

export function Countdown({ endsAt }: { endsAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!endsAt) return null;
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className={cx("font-mono tabular-nums", left <= 15 ? "text-blood-400" : "text-ink-100")} aria-label={`${left} seconds left`}>
      {mm}:{ss}
    </span>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
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
