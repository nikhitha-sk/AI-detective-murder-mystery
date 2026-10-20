"use client";

import type { Phase } from "@mystery/shared";
import Link from "next/link";
import { useState } from "react";
import { useGame, useMe } from "@/store/game";
import { Button, Countdown, cx } from "./ui";

const PHASES: { id: Phase; label: string }[] = [
  { id: "lobby", label: "Lobby" },
  { id: "briefing", label: "Briefing" },
  { id: "interrogation", label: "Interrogation" },
  { id: "discussion", label: "Discussion" },
  { id: "voting", label: "Vote" },
  { id: "reveal", label: "Reveal" },
];

const SKIP_LABEL: Partial<Record<Phase, string>> = {
  briefing: "Begin interrogation",
  interrogation: "End round",
  discussion: "Go to the vote",
  voting: "Close the vote",
};

export function RoomHeader() {
  const view = useGame((s) => s.view)!;
  const connected = useGame((s) => s.connected);
  const advance = useGame((s) => s.advance);
  const leave = useGame((s) => s.leaveRoom);
  const me = useMe();
  const [copied, setCopied] = useState(false);
  const isHost = me?.isHost ?? false;
  const phaseIndex = PHASES.findIndex((p) => p.id === (view.phase === "generating" ? "lobby" : view.phase));

  function copy() {
    const url = `${window.location.origin}/room/${view.code}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/80 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-5">
        <Link href="/" onClick={leave} className="font-display text-lg font-extrabold tracking-tight" title="Leave room">
          AI Detective
        </Link>
        {view.case && <span className="hidden truncate text-sm text-ink-300 md:inline">· {view.case.title}</span>}

        <button
          onClick={copy}
          className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 font-mono text-sm tracking-[0.2em] hover:border-plum-500"
          title="Copy invite link"
        >
          {copied ? "copied!" : view.code}
        </button>
        {view.solo && <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-ink-300">solo</span>}
        {view.llmMode === "mock" && (
          <span className="rounded-full bg-clue-900 px-2 py-0.5 text-xs text-clue-300" title="No GROQ_API_KEY: hand-written cases and rule-based suspects">
            mock AI
          </span>
        )}

        <ol className="order-last flex w-full items-center gap-1 overflow-x-auto text-xs lg:order-none lg:ml-auto lg:w-auto">
          {PHASES.map((p, i) => (
            <li
              key={p.id}
              className={cx(
                "whitespace-nowrap rounded-full px-2.5 py-1",
                i === phaseIndex ? "bg-plum-600 text-white" : i < phaseIndex ? "text-ink-300" : "text-ink-400/70",
              )}
            >
              {p.label}
              {p.id === "interrogation" && view.round > 0 && ` ${view.round}/${view.totalRounds}`}
            </li>
          ))}
        </ol>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          {view.phaseEndsAt && (
            <span className="rounded-md bg-ink-850 px-2.5 py-1 text-sm">
              <Countdown endsAt={view.phaseEndsAt} />
            </span>
          )}
          {isHost && SKIP_LABEL[view.phase] && (
            <Button variant="ghost" className="py-1.5" onClick={() => advance().catch(() => {})}>
              {SKIP_LABEL[view.phase]} ›
            </Button>
          )}
          <div className="flex -space-x-2" aria-label="Players">
            {view.players.map((p) => (
              <span
                key={p.id}
                title={`${p.name}${p.isHost ? " (host)" : ""}${p.connected ? "" : " - away"}`}
                className={cx(
                  "grid h-7 w-7 place-items-center rounded-full border-2 border-ink-950 bg-ink-700 text-[11px] font-bold",
                  !p.connected && "opacity-40",
                  p.isHost && "bg-plum-700",
                )}
              >
                {p.name[0]?.toUpperCase()}
              </span>
            ))}
          </div>
          <span className={cx("h-2 w-2 rounded-full", connected ? "bg-mint-400" : "bg-blood-500")} title={connected ? "Connected" : "Reconnecting..."} />
        </div>
      </div>
    </header>
  );
}
