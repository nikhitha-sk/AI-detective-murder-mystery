"use client";

import type { PublicSuspect } from "@mystery/shared";
import { motion } from "framer-motion";
import { useGame, type UiMessage } from "@/store/game";
import { Avatar, cx } from "./ui";

export function MessageItem({ m, suspect, showSuspect }: { m: UiMessage; suspect?: PublicSuspect; showSuspect?: boolean }) {
  const me = useGame((s) => s.playerId);
  const clue = useGame((s) => (m.clueId ? s.view?.clues.find((c) => c.id === m.clueId) : undefined));
  const name = suspect?.name ?? m.suspectId;
  const mine = m.askerId === me;

  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <div className={cx("flex", mine ? "justify-end" : "justify-start")}>
        <div className={cx("max-w-[85%] rounded-2xl px-4 py-2.5", mine ? "rounded-br-sm bg-plum-700/50" : "rounded-bl-sm bg-ink-800")}>
          <p className="mb-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-300">
            <span className="font-semibold text-ink-100">{mine ? "You" : m.askerName}</span>
            {showSuspect && <span>to {name}</span>}
            <span className={m.visibility === "private" ? "text-clue-400" : ""}>
              {m.visibility === "private" ? "private" : "public"}
            </span>
            <span>round {m.round}</span>
          </p>
          {clue && (
            <p className="mb-1.5 rounded-md border border-clue-400/40 bg-clue-900/60 px-2 py-1 font-type text-xs text-clue-300">
              Shows evidence {clue.id}: {clue.text}
            </p>
          )}
          <p className="whitespace-pre-wrap text-[15px]">{m.question}</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        {suspect && <Avatar id={suspect.id} name={suspect.name} size={32} />}
        <div
          className={cx(
            "max-w-[85%] rounded-2xl rounded-tl-sm border px-4 py-2.5",
            m.confession ? "border-blood-500/70 bg-blood-900/50" : "border-ink-700 bg-ink-850",
          )}
        >
          <p className="mb-0.5 text-[11px] font-semibold text-ink-300">
            {name}
            {m.confession && <span className="ml-2 text-blood-400">CONFESSION</span>}
            {m.deflected && <span className="ml-2 font-normal text-ink-400">(evasive)</span>}
          </p>
          {m.status === "pending" ? (
            <p className="flex items-center gap-1.5 text-sm italic text-ink-400">
              {name.split(" ")[0]} is thinking
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}>
                    ·
                  </motion.span>
                ))}
              </span>
            </p>
          ) : m.status === "failed" ? (
            <p className="text-sm text-blood-400">No answer. Try asking again.</p>
          ) : (
            <p className={cx("whitespace-pre-wrap text-[15px] leading-relaxed", m.status === "streaming" && "caret")}>{m.reply}</p>
          )}
        </div>
      </div>
    </motion.li>
  );
}

/** Every message the player can see, across all suspects. */
export function Transcript({ className }: { className?: string }) {
  const order = useGame((s) => s.order);
  const messages = useGame((s) => s.messages);
  const suspects = useGame((s) => s.view?.case?.suspects ?? []);
  const list = order.map((id) => messages[id]).filter(Boolean);
  if (!list.length) return <p className="p-5 text-sm text-ink-400">No questions have been asked yet.</p>;
  return (
    <ul className={cx("space-y-5 p-4", className)}>
      {list.map((m) => (
        <MessageItem key={m.id} m={m} suspect={suspects.find((s) => s.id === m.suspectId)} showSuspect />
      ))}
    </ul>
  );
}
