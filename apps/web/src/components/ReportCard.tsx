"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { gradeCase, loadAccusationEvidence, rankFor, recordCase, type CaseReport } from "@/lib/career";
import { sfx } from "@/lib/sfx";
import { useGame } from "@/store/game";
import { cx } from "./ui";

/** Animated number that counts up with blips, like a game's results screen. */
function CountUp({ to, delay = 0, className }: { to: number; delay?: number; className?: string }) {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setN(to);
      return;
    }
    let last = 0;
    const controls = animate(0, to, {
      delay,
      duration: Math.min(1.6, 0.4 + to / 200),
      ease: "easeOut",
      onUpdate: (v) => {
        const r = Math.round(v);
        if (r - last >= Math.max(1, Math.floor(to / 14))) {
          last = r;
          sfx.blip();
        }
        setN(r);
      },
    });
    return () => controls.stop();
  }, [to, delay, reduce]);
  return <span className={cx("tabular-nums", className)}>{n}</span>;
}

const VERDICT: Record<NonNullable<CaseReport["evidenceVerdict"]>, { text: string; tone: string }> = {
  key: { text: "Key evidence. Airtight.", tone: "text-mint-400" },
  supporting: { text: "It pointed the right way, but wasn't the key proof.", tone: "text-clue-300" },
  wrong: { text: "That exhibit pointed elsewhere.", tone: "text-blood-400" },
};

/** Your results for this case and your career rank, recorded once per case in this browser. */
export function ReportCard({ startDelay = 2.6 }: { startDelay?: number }) {
  const reveal = useGame((s) => s.reveal)!;
  const view = useGame((s) => s.view)!;
  const playerId = useGame((s) => s.playerId);
  const order = useGame((s) => s.order);
  const messages = useGame((s) => s.messages);

  const report = useMemo(
    () =>
      gradeCase({
        reveal,
        playerId,
        messages: order.map((id) => messages[id]).filter(Boolean),
        suspectIds: view.case!.suspects.map((s) => s.id),
        evidenceId: loadAccusationEvidence(view.code, view.case!.title),
      }),
    // Grade once per reveal: later message updates shouldn't change the results screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reveal],
  );

  // Recorded once per case (recordCase is idempotent, so a strict-mode double call is harmless).
  const [{ before, after }] = useState(() => recordCase(`${view.code}:${view.case!.title}:${reveal.killerId}`, report));
  const was = rankFor(before.xp);
  const now = rankFor(after.xp);
  const rankedUp = now.rank.title !== was.rank.title;
  const gained = after.xp - before.xp;
  const [stage, setStage] = useState<"before" | "after">("before");
  const shown = stage === "before" ? was : now;

  useEffect(() => {
    const t = setTimeout(() => {
      setStage("after");
      if (rankedUp) sfx.reward();
    }, (startDelay + 1.4 + report.badges.length * 0.25) * 1000);
    return () => clearTimeout(t);
  }, [startDelay, rankedUp, report.badges.length]);

  useEffect(() => {
    if (!report.badges.length) return;
    const t = setTimeout(() => sfx.reward(), (startDelay + 0.9) * 1000);
    return () => clearTimeout(t);
  }, [report.badges.length, startDelay]);

  const evidence = reveal.clues.find((c) => c.id === report.evidenceId);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: startDelay, type: "spring", stiffness: 120, damping: 16 }}
      className="relative overflow-hidden rounded-3xl border-2 border-clue-400/40 bg-gradient-to-br from-[#2a2010] via-ink-900 to-ink-950 p-5 shadow-[0_0_60px_rgb(245_184_61/0.12)] sm:p-7"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-clue-400/10 blur-3xl" />
      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="font-type text-xs uppercase tracking-[0.4em] text-clue-300">Detective report</p>
          <div className="mt-3 flex items-end gap-3">
            <CountUp to={report.baseScore} delay={startDelay + 0.3} className="font-display text-6xl font-extrabold leading-none" />
            <span className="pb-1 text-sm text-ink-300">case points</span>
          </div>
          <p className={cx("mt-2 font-semibold", report.correct ? "text-mint-400" : "text-blood-400")}>
            {report.correct ? "✓ You named the killer" : "✗ Your accusation missed"}
          </p>
          {evidence && report.evidenceVerdict && (
            <p className="mt-2 text-sm text-ink-300">
              Your proof, exhibit {evidence.id}:{" "}
              {report.correct || report.evidenceVerdict === "wrong" ? (
                <span className={VERDICT[report.evidenceVerdict].tone}>{VERDICT[report.evidenceVerdict].text}</span>
              ) : (
                <span className="text-clue-300">it pointed to the real killer, not to your suspect. So close.</span>
              )}
            </p>
          )}
          {!evidence && <p className="mt-2 text-sm text-ink-400">Tip: name your key exhibit when you accuse for bonus XP.</p>}

          <ul className="mt-4 flex flex-wrap gap-2">
            {report.badges.map((b, i) => (
              <motion.li
                key={b.id}
                initial={{ scale: 0, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ delay: startDelay + 0.9 + i * 0.25, type: "spring", stiffness: 260, damping: 12 }}
                className="flex items-center gap-2 rounded-xl border border-clue-400/40 bg-clue-900/40 px-3 py-2"
                title={b.description}
              >
                <span className="text-xl">{b.icon}</span>
                <span className="leading-tight">
                  <span className="block text-sm font-bold">{b.title}</span>
                  <span className="block text-[11px] text-ink-300">
                    {b.description}
                    {b.xp ? ` · +${b.xp} XP` : ""}
                  </span>
                </span>
              </motion.li>
            ))}
            {report.badges.length === 0 && <li className="text-sm text-ink-400">No badges this time. The next case is waiting.</li>}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <AnimatePresence mode="wait">
              <motion.span
                key={shown.rank.title}
                initial={{ scale: 0.3, rotate: -40, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#7a5a14] text-3xl shadow-[0_0_24px_rgb(212_175_55/0.45)]"
              >
                {shown.rank.icon}
              </motion.span>
            </AnimatePresence>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-400">Your rank</p>
              <AnimatePresence mode="wait">
                <motion.p key={shown.rank.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="font-display text-2xl font-bold">
                  {shown.rank.title}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs text-ink-400">{shown.next ? `${Math.max(0, shown.next.minXp - (stage === "before" ? before.xp : after.xp))} XP to ${shown.next.title}` : "Top rank reached"}</p>
            </div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: startDelay + 0.6 }}
              className="font-display text-2xl font-extrabold text-clue-300"
            >
              +{gained} XP
            </motion.span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink-700">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-clue-400 to-[#ffe9a8] shadow-[0_0_12px_rgb(245_184_61/0.7)]"
              initial={{ width: `${was.progress * 100}%` }}
              animate={{ width: `${(stage === "before" ? (rankedUp ? 1 : now.progress) : now.progress) * 100}%` }}
              transition={{ delay: stage === "before" ? startDelay + 0.8 : 0, duration: stage === "before" ? 1.2 : 0.8, ease: "easeOut" }}
            />
          </div>
          <AnimatePresence>
            {rankedUp && stage === "after" && (
              <motion.p
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-3 text-center font-display text-lg font-extrabold uppercase tracking-widest text-clue-300"
              >
                ★ Promoted to {now.rank.title}! ★
              </motion.p>
            )}
          </AnimatePresence>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Cases", after.cases],
              ["Solved", after.solved],
              ["Streak", after.streak],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-ink-850/80 px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-ink-400">{label}</dt>
                <dd className="font-display text-xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </motion.section>
  );
}
