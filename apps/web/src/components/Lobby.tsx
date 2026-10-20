"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { sfx } from "@/lib/sfx";
import { useGame, useMe } from "@/store/game";
import { ThemePicker } from "./ThemePicker";
import { Button, Panel, Spinner, cx } from "./ui";

export function Lobby() {
  const view = useGame((s) => s.view)!;
  const start = useGame((s) => s.start);
  const setTheme = useGame((s) => s.setTheme);
  const me = useMe();
  const [starting, setStarting] = useState(false);
  const isHost = me?.isHost ?? false;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Panel title="The case">
        <div className="p-5">
          {view.generation.status === "failed" && (
            <p className="mb-4 rounded-lg border border-blood-500/40 bg-blood-900/50 p-3 text-sm text-red-100">
              The last case couldn&apos;t be made fair: {view.generation.message}
            </p>
          )}
          <ThemePicker value={view.theme} disabled={!isHost} onChange={(t) => setTheme(t).catch(() => {})} />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {isHost ? (
              <Button
                className="px-7 py-3.5 text-base"
                disabled={starting}
                onClick={() => {
                  sfx.phase();
                  setStarting(true);
                  start().catch(() => setStarting(false));
                }}
              >
                {starting && <Spinner />} Open the case file
              </Button>
            ) : (
              <p className="flex items-center gap-2 text-ink-300">
                <Spinner className="text-clue-400" /> Waiting for the host to start the game...
              </p>
            )}
            <p className="text-sm text-ink-400">
              {view.totalRounds} rounds · {view.questionsPerRound} questions per detective per round
            </p>
          </div>
        </div>
      </Panel>

      <Panel title={`Detectives (${view.players.length}/6)`}>
        <ul className="grid grid-cols-2 gap-2 p-3">
          {view.players.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, scale: 0.8, rotate: -4 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: i * 0.06, type: "spring" }}
              className={cx("relative rounded-xl border p-3", p.id === me?.id ? "border-clue-400/60 bg-clue-900/30" : "border-ink-700 bg-ink-850")}
            >
              <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#8a6a1f] font-display text-lg font-bold text-ink-950 shadow-[0_0_0_3px_#3a2a0b]">
                {p.name[0]?.toUpperCase()}
              </div>
              <p className="mt-2 truncate font-semibold">{p.name}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <span className={cx("h-1.5 w-1.5 rounded-full", p.connected ? "bg-mint-400" : "bg-ink-600")} />
                {p.isHost ? "Lead detective" : "Detective"}
                {p.id === me?.id && " (you)"}
              </p>
            </motion.li>
          ))}
          {Array.from({ length: Math.max(0, (view.solo ? 1 : 2) - view.players.length) }, (_, i) => (
            <li key={`empty-${i}`} className="grid place-items-center rounded-xl border border-dashed border-ink-700 p-3 text-xs text-ink-400">
              Waiting...
            </li>
          ))}
        </ul>
        {!view.solo && (
          <p className="border-t border-ink-700/70 px-5 py-4 text-sm text-ink-300">
            Invite friends: share the code <span className="font-mono tracking-widest text-ink-100">{view.code}</span> or click it in the header
            to copy a link.
          </p>
        )}
      </Panel>
    </div>
  );
}
