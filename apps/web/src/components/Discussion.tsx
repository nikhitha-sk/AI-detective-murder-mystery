"use client";

import { Transcript } from "./Chat";
import { EvidenceBoard } from "./Interrogation";
import { Pinboard } from "./Pinboard";
import { Panel } from "./ui";

export function Discussion() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-plum-600/40 bg-plum-700/15 p-4">
          <h1 className="font-display text-2xl font-bold">Compare notes</h1>
          <p className="text-sm text-ink-300">
            Questioning is over. Share what your private interrogations revealed, arrange the board, and agree on a theory
            before the vote.
          </p>
        </div>
        <section className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-900/80">
          <Pinboard />
        </section>
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
