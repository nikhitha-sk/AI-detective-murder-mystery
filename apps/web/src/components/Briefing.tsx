"use client";

import type { PublicSuspect } from "@mystery/shared";
import { motion } from "framer-motion";
import { useState } from "react";
import type { Expression } from "@/lib/expression";
import { useGame } from "@/store/game";
import { Portrait, suspectSeed } from "./Portrait";
import { Scene } from "./Scene";

export function CaseFile() {
  const c = useGame((s) => s.view!.case)!;
  return (
    <div className="paper relative rounded-md p-6 shadow-2xl sm:p-8">
      <span className="absolute -top-3 left-8 h-6 w-24 rotate-[-3deg] bg-[#e8dcc0]/80 shadow" aria-hidden />
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
      <span className="stamp absolute right-6 top-6 rotate-[8deg] text-lg font-bold text-blood-500 opacity-70 [mix-blend-mode:multiply]">Homicide</span>
    </div>
  );
}

function VictimPhoto() {
  const c = useGame((s) => s.view!.case)!;
  const theme = useGame((s) => s.view!.theme);
  return (
    <div className="relative mx-auto w-[220px] rotate-[3deg] bg-[#f7f4ee] p-3 pb-10 shadow-[0_20px_40px_rgb(0_0_0/0.6)]">
      <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-gradient-to-br from-red-400 to-red-700 shadow" />
      <div className="overflow-hidden bg-[#2a2630]">
        <Portrait seed={{ id: "victim", name: c.victim.name, role: c.victim.description, bio: c.victim.description, theme }} deceased crop="head" size={196} />
      </div>
      <p className="mt-2 pb-3 text-center font-hand text-2xl leading-none text-[#2b2116]">{c.victim.name}</p>
      <span className="stamp absolute bottom-2 left-1/2 -translate-x-1/2 rotate-[-6deg] whitespace-nowrap bg-[#f7f4ee]/70 text-sm font-bold text-blood-500 [mix-blend-mode:normal]">
        Deceased {c.victim.timeOfDeath}
      </span>
    </div>
  );
}

function SuspectCard({ s, i }: { s: PublicSuspect; i: number }) {
  const theme = useGame((st) => st.view!.theme);
  const [hover, setHover] = useState(false);
  const moods: Expression[] = ["smug", "nervous", "calm", "angry", "sad"];
  return (
    <motion.article
      initial={{ opacity: 0, y: 40, rotate: i % 2 ? 4 : -4 }}
      animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1.2 : -1.2 }}
      whileHover={{ rotate: 0, y: -6, scale: 1.03 }}
      transition={{ delay: 0.4 + i * 0.15, type: "spring", stiffness: 140, damping: 16 }}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      className="relative bg-[#f7f4ee] p-2.5 pb-4 text-[#2b2116] shadow-[0_16px_32px_rgb(0_0_0/0.55)]"
    >
      <span className="absolute -top-2 left-1/2 z-10 h-4 w-4 -translate-x-1/2 rounded-full bg-gradient-to-br from-red-400 to-red-700 shadow" />
      <div className="relative overflow-hidden bg-gradient-to-b from-[#3a3046] to-[#15111c]">
        <Portrait seed={suspectSeed(s, theme)} expression={hover ? moods[i % moods.length] : "neutral"} size={220} className="mx-auto -mb-6 h-auto w-full" />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 font-mono text-[11px] text-white">#{i + 1}</span>
      </div>
      <h3 className="mt-2 font-display text-lg font-bold leading-tight">{s.name}</h3>
      <p className="text-sm font-semibold text-blood-500">{s.role}</p>
      <p className="mt-1.5 text-[13px] leading-snug opacity-80">{s.bio}</p>
      <p className="mt-1.5 font-type text-[11px] opacity-60">{s.relationshipToVictim}</p>
    </motion.article>
  );
}

export function Briefing() {
  const c = useGame((s) => s.view!.case)!;
  const theme = useGame((s) => s.view!.theme);
  return (
    <div className="mx-auto max-w-6xl">
      <Scene theme={theme} variant="hero" className="rounded-3xl border border-ink-700/80 p-5 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_260px]">
          <motion.div initial={{ opacity: 0, y: 20, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -0.6 }} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
            <CaseFile />
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8, rotate: 12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.25, type: "spring" }}>
            <VictimPhoto />
          </motion.div>
        </div>
      </Scene>

      <div className="mt-10 flex items-end justify-between gap-4">
        <div>
          <p className="font-type text-xs uppercase tracking-[0.3em] text-clue-400">Persons of interest</p>
          <h2 className="font-display text-3xl font-bold">Meet the suspects</h2>
        </div>
        <p className="hidden text-sm text-ink-400 sm:block">Hover a photo to study their face.</p>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {c.suspects.map((s, i) => (
          <SuspectCard key={s.id} s={s} i={i} />
        ))}
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="mt-8 text-center font-type text-sm text-ink-300">
        One of them is lying about murder. The others are hiding secrets of their own. Interrogation starts when the timer runs out or the
        host begins it.
      </motion.p>
    </div>
  );
}
