"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";
import { useGame, useMe } from "@/store/game";
import { Transcript } from "./Chat";
import { Portrait, suspectSeed } from "./Portrait";
import { Scene } from "./Scene";
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
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (!reveal) return;
    const t1 = setTimeout(() => {
      setFlash(1);
      sfx.thunder();
    }, 900);
    const t2 = setTimeout(() => sfx.stamp(), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reveal]);

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
      <Scene theme={view.theme} variant="hero" flashKey={flash} mood={80} className="rounded-3xl border border-blood-500/40">
        <div className="flex flex-col items-center px-4 pb-0 pt-8 text-center">
          <motion.p {...appear(0.1)} className="font-type text-sm uppercase tracking-[0.5em] text-ink-300">
            The killer was
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 1.5, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.9, duration: 0.8 }}
            className="mt-2 font-display text-5xl font-extrabold drop-shadow-[0_4px_30px_rgb(220_38_38/0.7)] sm:text-6xl"
          >
            {reveal.killerName}
          </motion.h1>
          <motion.p {...appear(1.2)} className="text-blood-400">
            {killer.role}
          </motion.p>
          <div className="relative mt-2">
            <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, type: "spring", stiffness: 90, damping: 14 }}>
              <Portrait
                seed={suspectSeed(killer, view.theme)}
                expression={reveal.playersWon ? "broken" : "smug"}
                size={280}
                className="h-auto w-[240px] drop-shadow-[0_20px_40px_rgb(0_0_0/0.8)] sm:w-[280px]"
              />
            </motion.div>
            <motion.span
              initial={{ scale: 3, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: -14 }}
              transition={{ delay: 2, type: "spring", stiffness: 220, damping: 12 }}
              className={cx(
                "stamp absolute left-1/2 top-1/2 -translate-x-1/2 whitespace-nowrap bg-black/30 text-4xl font-bold sm:text-5xl",
                reveal.playersWon ? "text-blood-400" : "text-clue-300",
              )}
            >
              {reveal.playersWon ? "Guilty" : "Got away"}
            </motion.span>
          </div>
        </div>
      </Scene>

      <motion.div {...appear(2.4)} className="mt-6 text-center">
        <p className={cx("font-display text-3xl font-bold", reveal.playersWon ? "text-mint-400" : "text-blood-400")}>
          {reveal.playersWon ? "Case closed. The room named the killer." : "The killer walked free."}
        </p>
        {myScore && (
          <p className="mt-1 text-ink-300">
            You accused {nameOf(myScore.votedFor)}
            {myScore.correct ? " - correct!" : "."}
          </p>
        )}
        <p className="mx-auto mt-4 max-w-2xl font-type text-[15px] leading-relaxed text-ink-300">{reveal.summary}</p>
      </motion.div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <motion.div {...appear(2.8)}>
          <Panel title="Who was closest">
            <ol className="divide-y divide-ink-700/70">
              {reveal.scores.map((s, i) => (
                <li key={s.playerId} className="flex items-center gap-3 px-4 py-3">
                  <span className={cx("grid h-8 w-8 place-items-center rounded-full font-mono text-sm", i === 0 ? "bg-clue-400 text-ink-950" : "bg-ink-800 text-ink-300")}>
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="font-semibold">{s.name}</span>
                    <span className="block text-xs text-ink-400">
                      voted {nameOf(s.votedFor)} · {s.keyCluesPresented} key clue{s.keyCluesPresented === 1 ? "" : "s"} put to the killer ·{" "}
                      {s.questionsToKiller} question{s.questionsToKiller === 1 ? "" : "s"} to them
                    </span>
                  </span>
                  <span className={cx("font-mono text-lg", s.correct ? "text-mint-400" : "text-ink-300")}>{s.score}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </motion.div>

        <motion.div {...appear(3)}>
          <Panel title="The true timeline">
            <ol className="relative space-y-3 p-4 pl-8">
              <span className="absolute bottom-4 left-[18px] top-4 w-px bg-ink-600" />
              {reveal.timeline.map((e, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 3.2 + i * 0.12 }} className="relative">
                  <span className="absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full bg-blood-500 ring-4 ring-ink-900" />
                  <span className="font-mono text-sm text-clue-400">{e.t}</span> <span className="text-[15px]">{e.event}</span>
                </motion.li>
              ))}
            </ol>
          </Panel>
        </motion.div>
      </div>

      <motion.div {...appear(3.4)} className="mt-5">
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
                    {toKiller ? `Pointed to the killer${c.contradicts ? " - broke their alibi" : ""}` : c.pointsTo ? `Red herring: ${nameOf(c.pointsTo)}'s secret` : "Background"}
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </motion.div>

      <motion.div {...appear(3.7)} className="mt-5">
        <Panel title="What everyone was hiding">
          <ul className="grid gap-3 p-4 md:grid-cols-2">
            {reveal.suspects.map((s) => {
              const isKiller = s.id === reveal.killerId;
              return (
                <li key={s.id} className={cx("flex gap-3 rounded-xl p-3", isKiller ? "bg-blood-900/40 ring-1 ring-blood-500/50" : "bg-ink-850")}>
                  <Avatar id={s.id} name={s.name} size={56} expression={isKiller ? (reveal.playersWon ? "broken" : "smug") : "relieved"} />
                  <div className="text-sm">
                    <p className="font-semibold">
                      {s.name} {isKiller && <span className="text-blood-400">(killer)</span>}
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
                    <p className="mt-1 text-xs text-ink-400">Votes: {Object.values(reveal.votes).filter((v) => v === s.id).length}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </motion.div>

      <motion.div {...appear(4)} className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-400">
          {Math.floor(reveal.stats.durationSec / 60)}m {reveal.stats.durationSec % 60}s · {reveal.stats.tokens.toLocaleString()} tokens · $
          {reveal.stats.costUsd.toFixed(3)} in model calls
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
