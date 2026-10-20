"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { baselineExpression } from "@/lib/expression";
import { sfx } from "@/lib/sfx";
import { useGame, useMe } from "@/store/game";
import { Portrait, suspectSeed } from "./Portrait";
import { Button, StressMeter, cx } from "./ui";

export function Voting() {
  const view = useGame((s) => s.view)!;
  const vote = useGame((s) => s.vote);
  const me = useMe();
  const [choice, setChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const voted = me?.hasVoted || submitted;
  const waitingOn = view.players.filter((p) => p.connected && !p.hasVoted);
  const suspects = view.case!.suspects;
  const chosen = suspects.find((s) => s.id === choice);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-center">
        <p className="font-type text-xs uppercase tracking-[0.4em] text-blood-400">The accusation</p>
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Who did it?</h1>
        <p className="mt-2 text-ink-300">Step up to the glass. One vote each, and it can&apos;t be changed.</p>
      </div>

      <div className="height-chart relative mt-8 overflow-hidden rounded-3xl border-4 border-ink-700 px-3 pt-10 shadow-[inset_0_0_80px_rgb(0_0_0/0.8)]">
        <div className="pointer-events-none absolute inset-y-0 left-2 flex flex-col justify-between py-6 font-mono text-[10px] text-white/40">
          {["7'", "6'", "5'", "4'", "3'"].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="relative flex items-end justify-center gap-1 sm:gap-3">
          {suspects.map((s, i) => {
            const isChosen = choice === s.id;
            const dim = choice !== null && !isChosen;
            return (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: dim ? 0.35 : 1, y: 0, scale: isChosen ? 1.06 : 1 }}
                transition={{ delay: choice === null ? 0.15 * i : 0, type: "spring", stiffness: 140, damping: 16 }}
                disabled={voted}
                onClick={() => {
                  sfx.click();
                  setChoice(s.id);
                }}
                className={cx("group relative flex w-1/5 max-w-[210px] flex-col items-center disabled:cursor-default", dim && "grayscale")}
              >
                <AnimatePresence>
                  {isChosen && (
                    <motion.div
                      className="pointer-events-none absolute -top-10 left-1/2 h-[130%] w-[160%] -translate-x-1/2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ background: "radial-gradient(ellipse at 50% 0%, rgb(255 235 190 / 0.4), transparent 65%)" }}
                    />
                  )}
                </AnimatePresence>
                <Portrait
                  seed={suspectSeed(s, view.theme)}
                  expression={isChosen ? (s.confessed ? "broken" : "scared") : s.confessed ? "broken" : baselineExpression(s.stress)}
                  size={210}
                  className="relative h-auto w-full transition-transform group-hover:-translate-y-1"
                />
                <span className="relative -mt-2 mb-3 w-[88%] rounded-sm bg-[#111] px-1 py-1 text-center font-mono text-[11px] text-white shadow sm:text-xs">
                  No. {i + 1} · {s.name.split(" ").slice(-1)[0]}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {suspects.map((s) => (
          <button
            key={s.id}
            disabled={voted}
            onClick={() => setChoice(s.id)}
            className={cx(
              "rounded-xl border p-3 text-left transition disabled:cursor-default",
              choice === s.id ? "border-blood-500 bg-blood-900/40 ring-1 ring-blood-500" : "border-ink-700 bg-ink-900/80 hover:border-ink-600",
            )}
          >
            <p className="font-display font-bold">{s.name}</p>
            <p className="text-xs text-ink-400">{s.role}</p>
            {s.confessed && <p className="mt-1 text-xs font-bold text-blood-400">Confessed during questioning</p>}
            <div className="mt-2">
              <StressMeter value={s.stress} />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        {voted ? (
          <motion.div initial={{ scale: 2.5, opacity: 0, rotate: -15 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} className="stamp text-2xl font-bold text-blood-400">
            Vote cast
          </motion.div>
        ) : (
          <Button
            variant="danger"
            className="px-10 py-4 text-lg"
            disabled={!choice}
            onClick={() => {
              if (!choice) return;
              sfx.stamp();
              setSubmitted(true);
              vote(choice).catch(() => setSubmitted(false));
            }}
          >
            {chosen ? `I accuse ${chosen.name}` : "Pick a suspect"}
          </Button>
        )}
        {voted && (
          <p className="text-ink-300">{waitingOn.length > 0 ? `Waiting for ${waitingOn.map((p) => p.name).join(", ")}...` : "Revealing the truth..."}</p>
        )}
        <p className="text-xs text-ink-400">
          {view.players.filter((p) => p.hasVoted).length} of {view.players.length} detectives have voted
        </p>
      </div>
    </div>
  );
}
