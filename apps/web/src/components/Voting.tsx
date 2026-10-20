"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useGame, useMe } from "@/store/game";
import { Avatar, Button, StressMeter, cx } from "./ui";

export function Voting() {
  const view = useGame((s) => s.view)!;
  const vote = useGame((s) => s.vote);
  const me = useMe();
  const [choice, setChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const voted = me?.hasVoted || submitted;
  const waitingOn = view.players.filter((p) => p.connected && !p.hasVoted);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold">Who did it?</h1>
        <p className="mt-2 text-ink-300">One vote each. You can&apos;t change it once it&apos;s cast.</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {view.case!.suspects.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            disabled={voted}
            onClick={() => setChoice(s.id)}
            className={cx(
              "rounded-2xl border p-4 text-left transition disabled:cursor-default",
              choice === s.id ? "border-blood-500 bg-blood-900/40 ring-2 ring-blood-500" : "border-ink-700 bg-ink-900 hover:border-ink-600",
            )}
          >
            <Avatar id={s.id} name={s.name} size={56} />
            <h2 className="mt-3 font-display text-xl font-bold">{s.name}</h2>
            <p className="text-sm text-plum-400">{s.role}</p>
            {s.confessed && <p className="mt-1 text-xs font-bold text-blood-400">Confessed during questioning</p>}
            <div className="mt-3">
              <StressMeter value={s.stress} />
            </div>
          </motion.button>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3">
        {voted ? (
          <p className="text-ink-300">
            Vote cast.{" "}
            {waitingOn.length > 0 ? `Waiting for ${waitingOn.map((p) => p.name).join(", ")}...` : "Revealing the truth..."}
          </p>
        ) : (
          <Button
            variant="danger"
            className="px-8 py-3 text-base"
            disabled={!choice}
            onClick={() => {
              if (!choice) return;
              setSubmitted(true);
              vote(choice).catch(() => setSubmitted(false));
            }}
          >
            Accuse {choice ? view.case!.suspects.find((s) => s.id === choice)?.name : "..."}
          </Button>
        )}
        <p className="text-xs text-ink-400">
          {view.players.filter((p) => p.hasVoted).length} of {view.players.length} detectives have voted
        </p>
      </div>
    </div>
  );
}
