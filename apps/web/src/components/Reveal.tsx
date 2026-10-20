"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useGame, useMe } from "@/store/game";
import { Transcript } from "./Chat";
import { Avatar, Button, Panel, Spinner, cx } from "./ui";

const appear = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] as const },
});

export function Reveal() {
  const reveal = useGame((s) => s.reveal);
  const view = useGame((s) => s.view)!;
  const restart = useGame((s) => s.restart);
  const me = useMe();
  const [showTranscript, setShowTranscript] = useState(false);

  if (!reveal) {
    return (
      <p className="mt-20 flex items-center justify-center gap-3 text-ink-300">
        <Spinner /> Opening the sealed envelope...
      </p>
    );
  }

  const suspects = view.case!.suspects;
  const killer = suspects.find((s) => s.id === reveal.killerId)!;
  const nameOf = (id: string | null) => suspects.find((s) => s.id === id)?.name ?? "nobody";
  const myScore = reveal.scores.find((s) => s.playerId === me?.id);

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <motion.p {...appear(0.1)} className="text-center text-sm uppercase tracking-[0.4em] text-ink-400">
        The killer was
      </motion.p>
      <motion.div
        initial={{ rotateY: 90, opacity: 0, scale: 0.9 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.9, duration: 0.9, type: "spring", bounce: 0.3 }}
        className="mx-auto mt-4 flex max-w-md flex-col items-center rounded-3xl border border-blood-500/60 bg-gradient-to-b from-blood-900/70 to-ink-900 p-8 text-center shadow-2xl shadow-blood-900/50"
        style={{ perspective: 800 }}
      >
        <Avatar id={killer.id} name={killer.name} size={96} />
        <h1 className="mt-4 font-display text-5xl font-extrabold">{reveal.killerName}</h1>
        <p className="mt-1 text-blood-400">{killer.role}</p>
      </motion.div>

      <motion.div {...appear(1.8)} className="mt-6 text-center">
        <p className={cx("font-display text-3xl font-bold", reveal.playersWon ? "text-mint-400" : "text-blood-400")}>
          {reveal.playersWon ? "Case closed. The room named the killer." : "The killer walked free."}
        </p>
        {myScore && (
          <p className="mt-1 text-ink-300">
            You accused {nameOf(myScore.votedFor)}
            {myScore.correct ? " - correct!" : "."}
          </p>
        )}
        <p className="mx-auto mt-4 max-w-2xl text-ink-300">{reveal.summary}</p>
      </motion.div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <motion.div {...appear(2.4)}>
          <Panel title="Who was closest">
            <ol className="divide-y divide-ink-700/70">
              {reveal.scores.map((s, i) => (
                <li key={s.playerId} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 font-mono text-ink-400">{i + 1}</span>
                  <span className="flex-1">
                    <span className="font-semibold">{s.name}</span>
                    <span className="block text-xs text-ink-400">
                      voted {nameOf(s.votedFor)} · {s.keyCluesPresented} key clue{s.keyCluesPresented === 1 ? "" : "s"} put to the
                      killer · {s.questionsToKiller} question{s.questionsToKiller === 1 ? "" : "s"} to them
                    </span>
                  </span>
                  <span className={cx("font-mono text-lg", s.correct ? "text-mint-400" : "text-ink-300")}>{s.score}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </motion.div>

        <motion.div {...appear(2.6)}>
          <Panel title="The true timeline">
            <ol className="relative space-y-3 p-4 pl-8">
              <span className="absolute bottom-4 left-[18px] top-4 w-px bg-ink-600" />
              {reveal.timeline.map((e, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2.8 + i * 0.12 }}
                  className="relative"
                >
                  <span className="absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full bg-plum-500 ring-4 ring-ink-900" />
                  <span className="font-mono text-sm text-plum-400">{e.t}</span> <span className="text-[15px]">{e.event}</span>
                </motion.li>
              ))}
            </ol>
          </Panel>
        </motion.div>
      </div>

      <motion.div {...appear(3.2)} className="mt-5">
        <Panel title="How the evidence fit">
          <ul className="grid gap-3 p-4 sm:grid-cols-2">
            {reveal.clues.map((c) => {
              const toKiller = c.pointsTo === reveal.killerId;
              return (
                <li key={c.id} className={cx("paper rounded-sm p-3 shadow", toKiller && "ring-2 ring-blood-500")}>
                  <p className="font-type text-[11px] uppercase tracking-widest opacity-60">
                    Exhibit {c.id} · round {c.round}
                    {c.isKey && " · key evidence"}
                  </p>
                  <p className="mt-1 font-type text-[13px]">{c.text}</p>
                  <p className={cx("mt-2 text-xs font-semibold", toKiller ? "text-blood-500" : "text-[#2b2116]/60")}>
                    {toKiller
                      ? `Pointed to the killer${c.contradicts ? " - broke their alibi" : ""}`
                      : c.pointsTo
                        ? `Red herring: ${nameOf(c.pointsTo)}'s secret`
                        : "Background"}
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </motion.div>

      <motion.div {...appear(3.5)} className="mt-5">
        <Panel title="What everyone was hiding">
          <ul className="grid gap-3 p-4 md:grid-cols-2">
            {reveal.suspects.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-xl bg-ink-850 p-3">
                <Avatar id={s.id} name={s.name} size={40} />
                <div className="text-sm">
                  <p className="font-semibold">
                    {s.name} {s.id === reveal.killerId && <span className="text-blood-400">(killer)</span>}
                  </p>
                  <p className="text-ink-300">
                    <span className="text-ink-400">Motive:</span> {s.motive}
                  </p>
                  <p className="text-ink-300">
                    <span className="text-ink-400">Claimed:</span> {s.alibi}
                  </p>
                  {s.secret && (
                    <p className="text-ink-300">
                      <span className="text-ink-400">Secret:</span> {s.secret}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-400">
                    Votes: {Object.values(reveal.votes).filter((v) => v === s.id).length}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </motion.div>

      <motion.div {...appear(3.8)} className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-400">
          {Math.floor(reveal.stats.durationSec / 60)}m {reveal.stats.durationSec % 60}s · {reveal.stats.tokens.toLocaleString()} tokens ·
          ${reveal.stats.costUsd.toFixed(3)} in model calls
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? "Hide" : "Show"} full transcript
          </Button>
          {me?.isHost && <Button onClick={() => restart().catch(() => {})}>Play another case</Button>}
        </div>
      </motion.div>

      {showTranscript && (
        <Panel title="Full transcript (private questions included)" className="mt-5">
          <Transcript />
        </Panel>
      )}
    </div>
  );
}
