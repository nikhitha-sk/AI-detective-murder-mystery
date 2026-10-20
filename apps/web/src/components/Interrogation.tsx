"use client";

import { MAX_QUESTION_CHARS } from "@mystery/shared";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame, useMe } from "@/store/game";
import { MessageItem } from "./Chat";
import { Pinboard } from "./Pinboard";
import { Avatar, Button, Panel, StressMeter, cx } from "./ui";

function SuspectList() {
  const suspects = useGame((s) => s.view!.case!.suspects);
  const selected = useGame((s) => s.selectedSuspectId);
  const select = useGame((s) => s.selectSuspect);
  const messages = useGame((s) => s.messages);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of Object.values(messages)) c[m.suspectId] = (c[m.suspectId] ?? 0) + 1;
    return c;
  }, [messages]);

  return (
    <Panel title="Suspects">
      <ul className="flex gap-2 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
        {suspects.map((s) => (
          <li key={s.id} className="min-w-[190px] lg:min-w-0">
            <button
              onClick={() => select(s.id)}
              className={cx(
                "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition",
                selected === s.id ? "bg-ink-700/80 ring-1 ring-plum-500" : "hover:bg-ink-800",
              )}
            >
              <Avatar id={s.id} name={s.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{s.name}</span>
                  {s.confessed && <span className="rounded bg-blood-500 px-1 text-[10px] font-bold text-white">CONFESSED</span>}
                </span>
                <span className="block truncate text-xs text-ink-400">
                  {s.role}
                  {counts[s.id] ? ` · ${counts[s.id]} Q` : ""}
                </span>
                <span className="mt-1.5 block">
                  <StressMeter value={s.stress} compact />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Composer({ suspectId }: { suspectId: string }) {
  const ask = useGame((s) => s.ask);
  const present = useGame((s) => s.present);
  const pendingClueId = useGame((s) => s.pendingClueId);
  const pickClue = useGame((s) => s.pickClue);
  const clue = useGame((s) => s.view!.clues.find((c) => c.id === s.pendingClueId));
  const suspect = useGame((s) => s.view!.case!.suspects.find((x) => x.id === suspectId))!;
  const timeOfDeath = useGame((s) => s.view!.case!.victim.timeOfDeath);
  const me = useMe();
  const [text, setText] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [sending, setSending] = useState(false);
  const left = me?.questionsLeft ?? 0;
  const first = suspect.name.split(" ").find((w) => !/^(Lady|Lord|Doctor|Dr\.?|Mr\.?|Mrs\.?)$/i.test(w)) ?? suspect.name;

  const suggestions = [
    `Where were you at ${timeOfDeath}?`,
    "What did you see or hear tonight?",
    "How did you get along with the victim?",
    "Who do you think did it?",
  ];

  async function send(question = text) {
    const q = question.trim();
    if (sending || left <= 0 || (!q && !pendingClueId)) return;
    setSending(true);
    try {
      if (pendingClueId) await present(suspectId, pendingClueId, q, isPrivate);
      else await ask(suspectId, q, isPrivate);
      setText("");
    } catch {
      /* toast already shown */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-ink-700/80 p-3">
      {clue && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-clue-400/50 bg-clue-900/70 p-2 font-type text-xs text-clue-300">
          <span className="flex-1">
            Presenting {clue.id}: {clue.text}
          </span>
          <button onClick={() => pickClue(null)} className="text-clue-300/70 hover:text-clue-300" aria-label="Remove evidence">
            ✕
          </button>
        </div>
      )}
      {!text && !clue && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setText(s)}
              className="shrink-0 rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300 hover:border-plum-500 hover:text-ink-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          maxLength={MAX_QUESTION_CHARS}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={clue ? `What do you want to ask ${first} about this? (optional)` : `Ask ${first} anything...`}
          className="min-h-[52px] flex-1 resize-none rounded-xl border border-ink-600 bg-ink-850 px-3 py-2.5 text-[15px] outline-none placeholder:text-ink-400 focus:border-plum-500"
        />
        <Button onClick={() => void send()} disabled={sending || left <= 0 || (!text.trim() && !clue)} className="h-[52px]">
          {clue ? "Present" : "Ask"}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex rounded-lg border border-ink-700 p-0.5" role="radiogroup" aria-label="Visibility">
          {[false, true].map((p) => (
            <button
              key={String(p)}
              role="radio"
              aria-checked={isPrivate === p}
              onClick={() => setPrivate(p)}
              className={cx("rounded-md px-2.5 py-1", isPrivate === p ? "bg-ink-700 text-ink-100" : "text-ink-400")}
            >
              {p ? "Private (only you see the answer)" : "Public (everyone sees it)"}
            </button>
          ))}
        </div>
        <span className={left <= 1 ? "text-clue-400" : "text-ink-400"}>
          {left} question{left === 1 ? "" : "s"} left this round
        </span>
      </div>
    </div>
  );
}

function ChatPanel() {
  const suspectId = useGame((s) => s.selectedSuspectId);
  const suspect = useGame((s) => s.view!.case!.suspects.find((x) => x.id === s.selectedSuspectId));
  const order = useGame((s) => s.order);
  const messages = useGame((s) => s.messages);
  const list = useMemo(() => order.map((id) => messages[id]).filter((m) => m && m.suspectId === suspectId), [order, messages, suspectId]);
  const endRef = useRef<HTMLDivElement>(null);
  const last = list[list.length - 1];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [list.length, last?.reply]);

  if (!suspect || !suspectId) return null;
  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <div className="flex items-center gap-3 border-b border-ink-700/80 p-4">
        <Avatar id={suspect.id} name={suspect.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold">{suspect.name}</h2>
          <p className="truncate text-sm text-ink-300">
            {suspect.role} · {suspect.relationshipToVictim}
          </p>
        </div>
        <div className="hidden w-36 sm:block">
          <StressMeter value={suspect.stress} />
        </div>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="grid h-full place-items-center p-8 text-center text-ink-400">
            <p>
              {suspect.bio}
              <br />
              <span className="text-sm">Ask your first question below.</span>
            </p>
          </div>
        ) : (
          <ul className="space-y-5 p-4">
            {list.map((m) => (
              <MessageItem key={m.id} m={m} suspect={suspect} />
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>
      <Composer suspectId={suspectId} />
    </div>
  );
}

export function EvidenceBoard({ allowPresent = true }: { allowPresent?: boolean }) {
  const clues = useGame((s) => s.view!.clues);
  const round = useGame((s) => s.view!.round);
  const pickClue = useGame((s) => s.pickClue);
  const pending = useGame((s) => s.pendingClueId);
  const addNote = useGame((s) => s.addNote);
  const notes = useGame((s) => s.notes);
  const total = useGame((s) => s.view!.totalRounds);

  return (
    <Panel title={`Evidence (${clues.length})`}>
      <ul className="scrollbar-thin max-h-[70vh] space-y-3 overflow-y-auto p-3">
        {clues.length === 0 && <li className="p-2 text-sm text-ink-400">Evidence unlocks at the start of each round.</li>}
        {[...clues].reverse().map((c) => (
          <motion.li
            key={c.id}
            layout
            initial={{ opacity: 0, rotate: -2, y: -10 }}
            animate={{ opacity: 1, rotate: 0, y: 0 }}
            className={cx("paper rounded-sm p-3 shadow-lg", pending === c.id && "ring-2 ring-clue-400")}
          >
            <p className="font-type text-[11px] uppercase tracking-widest opacity-60">
              Exhibit {c.id} · round {c.round}
              {c.round === round && " · new"}
            </p>
            <p className="mt-1 font-type text-[13px] leading-snug">{c.text}</p>
            <div className="mt-2 flex gap-2">
              {allowPresent && (
                <button
                  onClick={() => pickClue(pending === c.id ? null : c.id)}
                  className="rounded bg-[#2b2116] px-2 py-1 text-xs font-semibold text-[#f4ead2] hover:bg-black"
                >
                  {pending === c.id ? "Selected" : "Present to suspect"}
                </button>
              )}
              <button
                disabled={notes.some((n) => n.kind === "clue" && n.refId === c.id)}
                onClick={() =>
                  addNote({ kind: "clue", refId: c.id, text: c.text, x: 40 + Math.random() * 500, y: 40 + Math.random() * 260, color: "#f4ead2" }).catch(() => {})
                }
                className="rounded border border-[#2b2116]/40 px-2 py-1 text-xs hover:bg-[#2b2116]/10 disabled:opacity-40"
              >
                Pin to board
              </button>
            </div>
          </motion.li>
        ))}
        {round < total && (
          <li className="rounded-lg border border-dashed border-ink-600 p-3 text-center text-xs text-ink-400">
            More evidence unlocks in round {round + 1}
          </li>
        )}
      </ul>
    </Panel>
  );
}

export function Interrogation() {
  const [tab, setTab] = useState<"chat" | "board">("chat");
  return (
    <div className="grid gap-4 lg:grid-cols-[270px_minmax(0,1fr)_330px]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <SuspectList />
      </div>
      <section className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-900/80">
        <div className="flex border-b border-ink-700/80 text-sm">
          {(["chat", "board"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx("px-4 py-2.5 font-medium", tab === t ? "border-b-2 border-plum-500 text-ink-100" : "text-ink-400 hover:text-ink-100")}
            >
              {t === "chat" ? "Interrogation" : "Shared pinboard"}
            </button>
          ))}
        </div>
        {tab === "chat" ? <ChatPanel /> : <Pinboard />}
      </section>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <EvidenceBoard />
      </div>
    </div>
  );
}
