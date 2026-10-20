"use client";

import { Board } from "./board/Board";
import { useRoomBoard } from "./board/sources";
import { Transcript } from "./Chat";
import { EvidenceBoard } from "./Interrogation";
import { Panel } from "./ui";

export function Discussion() {
  const source = useRoomBoard();
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-clue-400/30 bg-gradient-to-r from-clue-900/50 to-ink-900/80 p-4">
          <h1 className="font-display text-2xl font-bold">Compare notes</h1>
          <p className="text-sm text-ink-300">
            Questioning is over. Share what your private interrogations revealed, work the board together, and agree on a theory before the
            vote.
          </p>
        </div>
        {source && (
          <section className="overflow-hidden rounded-2xl border border-ink-700/80">
            <Board source={source} className="h-[640px]" />
          </section>
        )}
        <EvidenceBoard allowPresent={false} />
      </div>
      <Panel title="Everything you heard" className="xl:sticky xl:top-20 xl:self-start">
        <div className="scrollbar-thin max-h-[78vh] overflow-y-auto">
          <Transcript />
        </div>
      </Panel>
    </div>
  );
}
