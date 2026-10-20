"use client";

import { THEMES, type ThemeId } from "@mystery/shared";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Spinner, Toasts, cx } from "@/components/ui";
import { getSavedName, saveName } from "@/lib/identity";
import { SERVER_URL } from "@/lib/socket";
import { useGame } from "@/store/game";

const PHASES = [
  ["Lobby", "room code, 2-6 players or solo"],
  ["Briefing", "victim, scene, suspect cards"],
  ["Interrogation x3", "timed rounds, question budget"],
  ["Discussion", "players compare notes"],
  ["Accusation", "one vote each"],
  ["Reveal", "true timeline, who was closest"],
];

type Health = { ok: boolean; llmMode: "groq" | "anthropic" | "mock"; redis: boolean; postgres: boolean } | null | "down";

export default function Home() {
  const router = useRouter();
  const createRoom = useGame((s) => s.createRoom);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<ThemeId>("manor-1920s");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<null | "create" | "solo" | "join">(null);
  const [health, setHealth] = useState<Health>(null);

  useEffect(() => {
    setName(getSavedName());
    fetch(`${SERVER_URL}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth("down"));
  }, []);

  const validName = name.trim().length > 0;

  async function create(solo: boolean) {
    if (!validName) return;
    setBusy(solo ? "solo" : "create");
    try {
      const code = await createRoom(name.trim(), theme, solo);
      router.push(`/room/${code}`);
    } catch {
      setBusy(null);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!validName || code.length !== 6) return;
    setBusy("join");
    // Persist the name first; the room page performs the join.
    saveName(name.trim());
    router.push(`/room/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-10 sm:px-6 lg:py-16">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-plum-400">A multiplayer deduction game</p>
        <h1 className="font-display text-5xl font-extrabold leading-[1.05] sm:text-7xl">
          AI Detective
          <span className="block text-ink-300">Murder Mystery</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-300">
          Every suspect is an AI with hidden motives and private memories. Question them in plain language, publicly or
          in private, confront them with evidence, then vote on who did it.
        </p>
      </motion.header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-2xl border border-ink-700 bg-ink-900/80 p-5 sm:p-6"
        >
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-ink-300" htmlFor="name">
            Your detective name
          </label>
          <input
            id="name"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Inspector Rao"
            className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-850 px-4 py-3 text-base outline-none placeholder:text-ink-400 focus:border-plum-500"
          />

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">Pick a setting</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cx(
                  "rounded-xl border p-4 text-left transition",
                  theme === t.id ? "border-plum-500 bg-plum-700/20" : "border-ink-700 bg-ink-850 hover:border-ink-600",
                )}
              >
                <span className="font-display text-lg font-bold">{t.label}</span>
                <span className="mt-1 block text-sm text-ink-300">{t.blurb}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => create(false)} disabled={!validName || busy !== null} className="px-6 py-3 text-base">
              {busy === "create" && <Spinner />} Create a room
            </Button>
            <Button variant="ghost" onClick={() => create(true)} disabled={!validName || busy !== null} className="px-6 py-3 text-base">
              {busy === "solo" && <Spinner />} Play solo
            </Button>
          </div>
          {!validName && <p className="mt-3 text-sm text-ink-400">Enter a name to start.</p>}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="flex flex-col gap-6"
        >
          <form onSubmit={join} className="rounded-2xl border border-ink-700 bg-ink-900/80 p-5 sm:p-6">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-ink-300" htmlFor="code">
              Join a room
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="code"
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="ROOM CODE"
                className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-4 py-3 font-mono text-lg tracking-[0.3em] outline-none placeholder:text-ink-400 placeholder:tracking-widest focus:border-plum-500"
              />
              <Button type="submit" disabled={!validName || joinCode.length !== 6 || busy !== null}>
                {busy === "join" && <Spinner />} Join
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-5 text-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">Server</p>
            {health === null && <p className="mt-2 text-ink-400">Checking...</p>}
            {health === "down" && (
              <p className="mt-2 text-blood-400">
                Can&apos;t reach the game server at {SERVER_URL}. Start it with <code className="font-mono">npm run dev</code>.
              </p>
            )}
            {health && health !== "down" && (
              <ul className="mt-2 space-y-1 text-ink-300">
                <li>
                  Suspects:{" "}
                  {health.llmMode === "groq" ? (
                    <span className="text-mint-400">Groq</span>
                  ) : health.llmMode === "anthropic" ? (
                    <span className="text-mint-400">Claude</span>
                  ) : (
                    <span className="text-clue-400">Mock AI (no API key, hand-written cases)</span>
                  )}
                </li>
                <li>Live state: {health.redis ? "Redis" : "in-memory"}</li>
                <li>History: {health.postgres ? "PostgreSQL" : "not saved"}</li>
              </ul>
            )}
          </div>
        </motion.section>
      </div>

      <ol className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PHASES.map(([title, sub], i) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="rounded-xl border border-ink-700 bg-ink-900/60 p-3"
          >
            <span className="text-xs font-mono text-plum-400">0{i + 1}</span>
            <span className="block font-semibold">{title}</span>
            <span className="block text-xs text-ink-400">{sub}</span>
          </motion.li>
        ))}
      </ol>
      <Toasts />
    </main>
  );
}
