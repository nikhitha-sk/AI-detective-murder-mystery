"use client";

import { MAX_QUESTION_CHARS, type PublicSuspect } from "@mystery/shared";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { EXPRESSION_LABEL, expressionFor } from "@/lib/expression";
import { sfx } from "@/lib/sfx";
import { useGame, useMe, type UiMessage } from "@/store/game";
import { Board } from "./board/Board";
import { useRoomBoard } from "./board/sources";
import { MessageItem, Spoken } from "./Chat";
import { Portrait, suspectSeed } from "./Portrait";
import { Scene } from "./Scene";
import { Button, Panel, StressMeter, cx } from "./ui";

/** Replies already typed out once (survives switching suspects or tabs). */
const typed = new Set<string>();

function useSuspectMessages(suspectId: string | null) {
  const order = useGame((s) => s.order);
  const messages = useGame((s) => s.messages);
  return useMemo(() => order.map((id) => messages[id]).filter((m) => m && m.suspectId === suspectId), [order, messages, suspectId]);
}

/** Reveals text a few characters at a time, with typewriter clicks. */
function useTypewriter(id: string | undefined, text: string, active: boolean) {
  const [shown, setShown] = useState(active ? 0 : text.length);
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    setSkip(false);
    setShown(active ? 0 : text.length);
  }, [id, active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || skip) {
      setShown(text.length);
      if (id && active) typed.add(id);
      return;
    }
    if (shown >= text.length) {
      if (id) typed.add(id);
      return;
    }
    const ch = text[shown];
    const delay = /[.!?]/.test(ch) ? 160 : /[,;:]/.test(ch) ? 80 : 22;
    const t = setTimeout(() => {
      setShown((n) => Math.min(text.length, n + 2));
      if (ch !== " ") sfx.type();
    }, delay);
    return () => clearTimeout(t);
  }, [active, skip, shown, text, id]);

  return { text: text.slice(0, shown), typing: active && !skip && shown < text.length, skip: () => setSkip(true) };
}

// ---------------------------------------------------------------------------
// Lineup
// ---------------------------------------------------------------------------

function LineupCard({ s, theme, selected, onSelect, last, count }: { s: PublicSuspect; theme: string; selected: boolean; onSelect: () => void; last?: UiMessage; count: number }) {
  const expression = expressionFor(last, s);
  const waiting = last?.status === "pending";
  return (
    <button
      onClick={onSelect}
      className={cx(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-2 text-left transition",
        selected ? "border-clue-400/80 bg-gradient-to-r from-clue-900/70 to-ink-850 shadow-[0_0_24px_rgb(245_184_61/0.18)]" : "border-ink-700 bg-ink-850/80 hover:border-ink-600",
      )}
    >
      <div className={cx("relative shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-[#3a3046] to-[#15111c]", s.confessed && "ring-2 ring-blood-500")}>
        <Portrait seed={suspectSeed(s, theme)} expression={expression} crop="head" size={62} />
        {waiting && <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-ping rounded-full bg-clue-400" />}
      </div>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-[15px] font-bold leading-tight">{s.name}</span>
        </span>
        <span className="block truncate text-[11px] text-ink-400">
          {s.role}
          {count ? ` · ${count} Q` : ""}
        </span>
        <span className="mt-1 block text-[10px] uppercase tracking-wider text-ink-300">
          {s.confessed ? <span className="font-bold text-blood-400">confessed</span> : EXPRESSION_LABEL[expression]}
        </span>
        <span className="mt-1 block">
          <StressMeter value={s.stress} compact />
        </span>
      </span>
    </button>
  );
}

function SuspectLineup() {
  const suspects = useGame((s) => s.view!.case!.suspects);
  const theme = useGame((s) => s.view!.theme);
  const selected = useGame((s) => s.selectedSuspectId);
  const select = useGame((s) => s.selectSuspect);
  const order = useGame((s) => s.order);
  const messages = useGame((s) => s.messages);
  const { counts, last } = useMemo(() => {
    const counts: Record<string, number> = {};
    const last: Record<string, UiMessage> = {};
    for (const id of order) {
      const m = messages[id];
      if (!m) continue;
      counts[m.suspectId] = (counts[m.suspectId] ?? 0) + 1;
      last[m.suspectId] = m;
    }
    return { counts, last };
  }, [order, messages]);

  return (
    <Panel title="The suspects">
      <ul className="flex gap-2 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
        {suspects.map((s) => (
          <li key={s.id} className="min-w-[220px] lg:min-w-0">
            <LineupCard
              s={s}
              theme={theme}
              selected={selected === s.id}
              onSelect={() => {
                sfx.click();
                select(s.id);
              }}
              last={last[s.id]}
              count={counts[s.id] ?? 0}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Stage: the suspect in the interrogation room
// ---------------------------------------------------------------------------

function Stage({ suspect, latest, talking }: { suspect: PublicSuspect; latest?: UiMessage; talking: boolean }) {
  const theme = useGame((s) => s.view!.theme);
  const clue = useGame((s) => (latest?.clueId ? s.view?.clues.find((c) => c.id === latest.clueId) : undefined));
  const expression = expressionFor(latest, suspect);
  const shake = useAnimationControls();
  const [flashKey, setFlashKey] = useState(0);
  const [pulse, setPulse] = useState(0);
  const prevStress = useRef(suspect.stress);
  const confessionSeen = useRef<string | null>(null);

  useEffect(() => {
    if (suspect.stress - prevStress.current >= 5) {
      setPulse((p) => p + 1);
      if (suspect.stress >= 70) sfx.tension();
    }
    prevStress.current = suspect.stress;
  }, [suspect.stress]);

  useEffect(() => {
    prevStress.current = suspect.stress;
  }, [suspect.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (latest?.confession && latest.status === "done" && confessionSeen.current !== latest.id) {
      confessionSeen.current = latest.id;
      if (!typed.has(latest.id)) {
        setFlashKey((k) => k + 1);
        void shake.start({ x: [0, -14, 12, -9, 7, -3, 0], transition: { duration: 0.6 } });
      }
    }
  }, [latest, shake]);

  const presenting = latest?.kind === "present" && clue && latest.status !== "done";

  return (
    <motion.div animate={shake} className="relative">
      <Scene theme={theme} variant="stage" mood={suspect.stress} flashKey={flashKey} className="h-[300px] sm:h-[360px] lg:h-[420px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={suspect.id}
            className="absolute bottom-6 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, x: 60, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -60, filter: "blur(6px)" }}
            transition={{ duration: 0.35 }}
          >
            <div className="drop-shadow-[0_20px_30px_rgb(0_0_0/0.7)]">
              <Portrait
                seed={suspectSeed(suspect, theme)}
                expression={expression}
                talking={talking}
                size={300}
                className="h-[280px] w-auto sm:h-[340px] lg:h-[390px]"
              />
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="table-edge absolute inset-x-0 bottom-0 z-20 h-12 sm:h-14" />

        <AnimatePresence>
          {presenting && (
            <motion.div
              key={latest?.id}
              className="paper absolute bottom-3 left-1/2 z-30 w-56 -translate-x-1/2 p-3 shadow-2xl"
              initial={{ y: 160, rotate: -18, opacity: 0 }}
              animate={{ y: 0, rotate: -4, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 16 }}
            >
              <p className="font-type text-[10px] uppercase tracking-widest opacity-60">Exhibit {clue.id}</p>
              <p className="mt-1 line-clamp-3 font-type text-xs leading-snug">{clue.text}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute left-3 top-3 z-30 max-w-[60%] rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2 backdrop-blur-md">
          <p className="font-display text-xl font-bold leading-tight sm:text-2xl">{suspect.name}</p>
          <p className="truncate text-xs text-ink-300">
            {suspect.role} · {suspect.relationshipToVictim}
          </p>
        </div>
        <div className="absolute right-3 top-3 z-30 w-40 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2 backdrop-blur-md">
          <StressMeter value={suspect.stress} />
          <p className="mt-1.5 text-[11px] text-ink-300">
            Looks <span className="font-semibold text-ink-100">{suspect.confessed ? "broken" : EXPRESSION_LABEL[expression]}</span>
          </p>
        </div>

        <AnimatePresence>
          {pulse > 0 && (
            <motion.div
              key={pulse}
              className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_120px_rgb(220_38_38/0.7)]"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
            />
          )}
        </AnimatePresence>

        {suspect.confessed && (
          <motion.div
            className="absolute bottom-16 right-4 z-40"
            initial={{ scale: 3, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: -12 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.3 }}
          >
            <span className="stamp bg-blood-900/40 text-2xl font-bold text-blood-400 sm:text-3xl">Confessed</span>
          </motion.div>
        )}
      </Scene>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Dialogue box and composer
// ---------------------------------------------------------------------------

function DialogueBox({ suspect, latest, tw }: { suspect: PublicSuspect; latest?: UiMessage; tw: ReturnType<typeof useTypewriter> }) {
  const me = useGame((s) => s.playerId);
  if (!latest) {
    return (
      <div className="relative rounded-2xl border-2 border-ink-600 bg-ink-900/95 px-5 py-4">
        <span className="absolute -top-3 left-4 rounded-md bg-clue-400 px-2 py-0.5 font-display text-sm font-bold text-ink-950">{suspect.name}</span>
        <p className="font-type text-[15px] leading-relaxed text-ink-300">
          <span className="italic">{suspect.bio}</span>
          <br />
          <span className="text-ink-400">Ask your first question below.</span>
        </p>
      </div>
    );
  }
  const asker = latest.askerId === me ? "You" : latest.askerName;
  return (
    <button
      type="button"
      onClick={tw.skip}
      className={cx(
        "relative block w-full rounded-2xl border-2 px-5 pb-4 pt-5 text-left",
        latest.confession ? "border-blood-500/80 bg-blood-900/40" : "border-ink-600 bg-ink-900/95",
      )}
      title={tw.typing ? "Click to skip" : undefined}
    >
      <span className="absolute -top-3 left-4 flex items-center gap-2">
        <span className="rounded-md bg-clue-400 px-2 py-0.5 font-display text-sm font-bold text-ink-950">{suspect.name}</span>
        {latest.confession && <span className="rounded-md bg-blood-500 px-2 py-0.5 text-xs font-bold text-white">CONFESSION</span>}
        {latest.deflected && <span className="rounded-md bg-ink-700 px-2 py-0.5 text-xs text-ink-300">evasive</span>}
      </span>
      <p className="mb-2 text-xs text-ink-400">
        <span className="font-semibold text-ink-300">{asker}</span>
        {latest.visibility === "private" && <span className="ml-1 text-clue-400">(private)</span>}
        {latest.kind === "present" ? " showed evidence " + latest.clueId + ": " : ": "}
        <span className="italic">&ldquo;{latest.question}&rdquo;</span>
      </p>
      {latest.status === "pending" || latest.status === "streaming" ? (
        <p className="flex items-center gap-1.5 font-type text-[15px] italic text-ink-400">
          {suspect.name.split(" ")[0]} {latest.kind === "present" ? "stares at the evidence" : "is thinking"}
          <span className="inline-flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}>
                ·
              </motion.span>
            ))}
          </span>
        </p>
      ) : latest.status === "failed" ? (
        <p className="text-sm text-blood-400">No answer. Try asking again.</p>
      ) : (
        <p className={cx("min-h-[3.2em] whitespace-pre-wrap font-type text-[16px] leading-relaxed text-ink-100", tw.typing && "caret")}>
          <Spoken text={tw.text} />
        </p>
      )}
      {tw.typing && <span className="absolute bottom-2 right-3 text-[10px] uppercase tracking-wider text-ink-400">click to skip ▸</span>}
    </button>
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
  const first = suspect.name.split(" ").find((w) => !/^(Lady|Lord|Doctor|Dr\.?|Mr\.?|Mrs\.?|Miss|Sir)$/i.test(w)) ?? suspect.name;

  const suggestions = [
    `Where were you at ${timeOfDeath}?`,
    "What did you see or hear tonight?",
    "How did you get along with the victim?",
    "What are you hiding?",
    "Who do you think did it?",
  ];

  async function send(question = text) {
    const q = question.trim();
    if (sending || left <= 0 || (!q && !pendingClueId)) return;
    setSending(true);
    try {
      if (pendingClueId) {
        sfx.present();
        await present(suspectId, pendingClueId, q, isPrivate);
      } else {
        sfx.click();
        await ask(suspectId, q, isPrivate);
      }
      setText("");
    } catch {
      /* toast already shown */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-700/80 bg-ink-900/90 p-3">
      {clue && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="paper mb-2 flex items-start gap-2 rounded-sm p-2.5 text-xs shadow-lg">
          <span className="flex-1 font-type">
            <span className="font-bold">Presenting exhibit {clue.id}:</span> {clue.text}
          </span>
          <button onClick={() => pickClue(null)} className="font-bold opacity-60 hover:opacity-100" aria-label="Remove evidence">
            ✕
          </button>
        </motion.div>
      )}
      {!text && !clue && (
        <div className="scrollbar-thin mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setText(s)}
              className="shrink-0 rounded-full border border-ink-700 bg-ink-850 px-3 py-1 text-xs text-ink-300 transition hover:border-clue-400/60 hover:text-ink-100"
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
          placeholder={clue ? `What do you want to ask ${first} about this? (optional)` : `Question ${first}...`}
          className="min-h-[52px] flex-1 resize-none rounded-xl border border-ink-600 bg-ink-850 px-3 py-2.5 text-[15px] outline-none placeholder:text-ink-400 focus:border-clue-400/70"
        />
        <Button variant={clue ? "clue" : "primary"} onClick={() => void send()} disabled={sending || left <= 0 || (!text.trim() && !clue)} className="h-[52px] px-5">
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
              {p ? "Private (only you hear the answer)" : "Public (everyone hears it)"}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1" aria-label={`${left} questions left this round`}>
          {Array.from({ length: Math.max(left, 0) }, (_, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-clue-400 shadow-[0_0_6px_rgb(245_184_61/0.6)]" />
          ))}
          <span className={cx("ml-1", left <= 1 ? "text-clue-400" : "text-ink-400")}>
            {left} question{left === 1 ? "" : "s"} left
          </span>
        </span>
      </div>
    </div>
  );
}

function InterrogationRoom() {
  const suspectId = useGame((s) => s.selectedSuspectId);
  const suspect = useGame((s) => s.view!.case!.suspects.find((x) => x.id === s.selectedSuspectId));
  const list = useSuspectMessages(suspectId);
  const latest = list[list.length - 1];
  const fresh = !!latest && latest.status === "done" && !typed.has(latest.id);
  const tw = useTypewriter(latest?.id, latest?.status === "done" ? latest.reply : "", fresh);
  const [showLog, setShowLog] = useState(true);
  const logRef = useRef<HTMLUListElement>(null);

  // Scroll the record itself, never the page, so the suspect stays in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [list.length, showLog]);

  if (!suspect || !suspectId) return null;
  const history = list.slice(0, -1);

  return (
    <div className="space-y-3">
      <Stage suspect={suspect} latest={latest} talking={tw.typing} />
      <DialogueBox suspect={suspect} latest={latest} tw={tw} />
      <Composer suspectId={suspectId} />
      {history.length > 0 && (
        <div className="rounded-2xl border border-ink-700/80 bg-ink-900/80">
          <button onClick={() => setShowLog((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
            Interrogation record ({history.length})<span>{showLog ? "▾" : "▸"}</span>
          </button>
          {showLog && (
            <ul ref={logRef} className="scrollbar-thin max-h-[420px] space-y-5 overflow-y-auto border-t border-ink-700/80 p-4">
              {history.map((m) => (
                <MessageItem key={m.id} m={m} suspect={suspect} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export function EvidenceBoard({ allowPresent = true }: { allowPresent?: boolean }) {
  const clues = useGame((s) => s.view!.clues);
  const round = useGame((s) => s.view!.round);
  const pickClue = useGame((s) => s.pickClue);
  const pending = useGame((s) => s.pendingClueId);
  const addNote = useGame((s) => s.addNote);
  const notes = useGame((s) => s.notes);
  const total = useGame((s) => s.view!.totalRounds);

  return (
    <Panel title={`Evidence dossier (${clues.length})`}>
      <ul className="scrollbar-thin max-h-[72vh] space-y-3 overflow-y-auto p-3">
        {clues.length === 0 && <li className="p-2 text-sm text-ink-400">Evidence unlocks at the start of each round.</li>}
        <AnimatePresence initial={false}>
          {[...clues].reverse().map((c, i) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0, rotate: -8, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, rotate: i % 2 ? 0.8 : -0.8, y: 0, scale: 1 }}
              whileHover={{ rotate: 0, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className={cx("paper relative rounded-sm p-3 shadow-lg", pending === c.id && "ring-2 ring-clue-400")}
            >
              <span className="absolute -top-1.5 right-4 h-5 w-3 rounded-sm bg-ink-400/70" aria-hidden />
              <p className="font-type text-[11px] uppercase tracking-widest opacity-60">
                Exhibit {c.id} · round {c.round}
                {c.round === round && <span className="ml-1 rounded bg-blood-500 px-1 text-[9px] font-bold text-white">NEW</span>}
              </p>
              <p className="mt-1 font-type text-[13px] leading-snug">{c.text}</p>
              <div className="mt-2 flex gap-2">
                {allowPresent && (
                  <button
                    onClick={() => {
                      sfx.click();
                      pickClue(pending === c.id ? null : c.id);
                    }}
                    className="rounded bg-[#2b2116] px-2 py-1 text-xs font-semibold text-[#f4ead2] hover:bg-black"
                  >
                    {pending === c.id ? "Selected ✓" : "Present to suspect"}
                  </button>
                )}
                <button
                  disabled={notes.some((n) => n.kind === "clue" && n.refId === c.id)}
                  onClick={() =>
                    addNote({ kind: "clue", refId: c.id, text: c.text, x: 60 + Math.round(Math.random() * 900), y: 60 + Math.round(Math.random() * 600), color: "#f4ead2" }).catch(() => {})
                  }
                  className="rounded border border-[#2b2116]/40 px-2 py-1 text-xs hover:bg-[#2b2116]/10 disabled:opacity-40"
                >
                  Pin to board
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {round < total && (
          <li className="rounded-lg border border-dashed border-ink-600 p-3 text-center text-xs text-ink-400">More evidence unlocks in round {round + 1}</li>
        )}
      </ul>
    </Panel>
  );
}

function RoomBoard() {
  const source = useRoomBoard();
  if (!source) return null;
  return <Board source={source} className="h-[680px]" />;
}

export function Interrogation() {
  const [tab, setTab] = useState<"room" | "board">("room");
  const selected = useGame((s) => s.view!.case!.suspects.find((x) => x.id === s.selectedSuspectId));
  return (
    <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_320px]">
      <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <SuspectLineup />
      </div>
      <section className="min-w-0">
        <div className="mb-3 flex items-center gap-1 rounded-xl border border-ink-700/80 bg-ink-900/80 p-1 text-sm">
          {(["room", "board"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx("flex-1 rounded-lg px-4 py-2 font-semibold transition", tab === t ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100")}
            >
              {t === "room" ? `Interrogation room${selected ? `: ${selected.name}` : ""}` : "Detective board"}
            </button>
          ))}
        </div>
        {tab === "room" ? (
          <InterrogationRoom />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-ink-700/80">
            <RoomBoard />
          </div>
        )}
      </section>
      <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <EvidenceBoard />
      </div>
    </div>
  );
}

