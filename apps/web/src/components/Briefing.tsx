"use client";

import { motion } from "framer-motion";
import { useGame } from "@/store/game";
import { Avatar } from "./ui";

export function CaseFile() {
  const c = useGame((s) => s.view!.case)!;
  return (
    <div className="paper rounded-md p-6 shadow-2xl sm:p-8">
      <p className="font-type text-xs uppercase tracking-[0.3em] opacity-70">Case file · confidential</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{c.title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed">{c.setting}</p>
      <dl className="mt-5 grid gap-x-6 gap-y-3 font-type text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase opacity-60">Victim</dt>
          <dd>
            {c.victim.name}, {c.victim.description}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase opacity-60">Cause of death</dt>
          <dd>{c.victim.cause}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase opacity-60">Time of death</dt>
          <dd>about {c.victim.timeOfDeath}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase opacity-60">Found by</dt>
          <dd>{c.victim.foundBy}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase opacity-60">The scene</dt>
          <dd>{c.victim.scene}</dd>
        </div>
      </dl>
    </div>
  );
}

export function Briefing() {
  const c = useGame((s) => s.view!.case)!;
  return (
    <div className="mx-auto max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 20, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }}>
        <CaseFile />
      </motion.div>
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">The suspects</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {c.suspects.map((s, i) => (
          <motion.article
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="rounded-2xl border border-ink-700 bg-ink-900 p-4"
          >
            <Avatar id={s.id} name={s.name} size={56} />
            <h3 className="mt-3 font-display text-xl font-bold">{s.name}</h3>
            <p className="text-sm text-plum-400">{s.role}</p>
            <p className="mt-2 text-sm text-ink-300">{s.bio}</p>
            <p className="mt-2 text-xs text-ink-400">{s.relationshipToVictim}</p>
          </motion.article>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-ink-400">
        One of them is lying about murder. The others are hiding secrets of their own. Interrogation starts when the timer
        runs out or the host begins it.
      </p>
    </div>
  );
}
