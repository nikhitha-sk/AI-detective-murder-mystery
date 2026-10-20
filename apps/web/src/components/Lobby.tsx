"use client";

import { THEMES } from "@mystery/shared";
import { motion } from "framer-motion";
import { useState } from "react";
import { useGame, useMe } from "@/store/game";
import { Button, Panel, Spinner, cx } from "./ui";

export function Lobby() {
  const view = useGame((s) => s.view)!;
  const start = useGame((s) => s.start);
  const setTheme = useGame((s) => s.setTheme);
  const me = useMe();
  const [starting, setStarting] = useState(false);
  const isHost = me?.isHost ?? false;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Panel title="The case">
        <div className="p-5">
          {view.generation.status === "failed" && (
            <p className="mb-4 rounded-lg border border-blood-500/40 bg-blood-900/50 p-3 text-sm text-red-100">
              The last case couldn&apos;t be made fair: {view.generation.message}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                disabled={!isHost}
                onClick={() => setTheme(t.id).catch(() => {})}
                className={cx(
                  "rounded-xl border p-4 text-left transition disabled:cursor-default",
                  view.theme === t.id ? "border-plum-500 bg-plum-700/20" : "border-ink-700 bg-ink-850",
                  isHost && view.theme !== t.id && "hover:border-ink-600",
                )}
              >
                <span className="font-display text-lg font-bold">{t.label}</span>
                <span className="mt-1 block text-sm text-ink-300">{t.blurb}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {isHost ? (
              <Button
                className="px-6 py-3 text-base"
                disabled={starting}
                onClick={() => {
                  setStarting(true);
                  start().catch(() => setStarting(false));
                }}
              >
                {starting && <Spinner />} Start the investigation
              </Button>
            ) : (
              <p className="text-ink-300">Waiting for the host to start the game...</p>
            )}
            <p className="text-sm text-ink-400">
              {view.totalRounds} rounds · {view.questionsPerRound} questions per player per round
            </p>
          </div>
        </div>
      </Panel>

      <Panel title={`Detectives (${view.players.length}/6)`}>
        <ul className="divide-y divide-ink-700/70">
          {view.players.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 px-5 py-3"
            >
              <span className={cx("h-2 w-2 rounded-full", p.connected ? "bg-mint-400" : "bg-ink-600")} />
              <span className="font-medium">{p.name}</span>
              {p.isHost && <span className="rounded bg-plum-700/40 px-1.5 text-xs text-plum-400">host</span>}
              {p.id === me?.id && <span className="text-xs text-ink-400">(you)</span>}
            </motion.li>
          ))}
        </ul>
        {!view.solo && (
          <p className="border-t border-ink-700/70 px-5 py-4 text-sm text-ink-300">
            Invite friends: share the code <span className="font-mono tracking-widest text-ink-100">{view.code}</span> or
            click it in the header to copy a link.
          </p>
        )}
      </Panel>
    </div>
  );
}
