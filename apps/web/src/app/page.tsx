"use client";

import { THEMES, sceneOf, themeInput, type SceneStyle, type Theme } from "@mystery/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { icons } from "@/components/board/Board";
import { CareerCard } from "@/components/CareerCard";
import { SoundToggle, useBoardOverlay } from "@/components/GlobalBoard";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { ThemePicker } from "@/components/ThemePicker";
import { Button, Spinner, Toasts, cx } from "@/components/ui";
import type { Expression } from "@/lib/expression";
import { getSavedName, saveName } from "@/lib/identity";
import { sfx } from "@/lib/sfx";
import { SERVER_URL } from "@/lib/socket";
import { allThemes, useThemeLibrary } from "@/lib/themes";
import { useGame } from "@/store/game";

const STEPS = [
  ["Briefing", "Read the case file and meet the suspects"],
  ["Interrogate", "Three timed rounds. Ask anything, publicly or in private"],
  ["Present evidence", "New clues unlock each round. Confront them"],
  ["Work the board", "Pin, draw and connect the dots"],
  ["Accuse", "One vote each in the lineup"],
  ["The reveal", "The truth, the timeline, and who was closest"],
];

type CastMember = { id: string; name: string; role: string };

/** Sample cast shown on the title screen. */
const CAST: Record<string, CastMember[]> = {
  "manor-1920s": [
    { id: "h1", name: "Lady Evelyn Ashford", role: "the widow" },
    { id: "h2", name: "Mr. Silas Crane", role: "butler" },
    { id: "h3", name: "Miss Clara Vane", role: "jazz singer" },
    { id: "h4", name: "Dr. Arthur Penhallow", role: "family doctor" },
    { id: "h5", name: "Lord Edmund Hale", role: "nephew" },
  ],
  "college-fest": [
    { id: "h1", name: "Ms. Priya Raman", role: "fest organiser" },
    { id: "h2", name: "Mr. Arjun Mehta", role: "band frontman" },
    { id: "h3", name: "Miss Zoe Kim", role: "student president" },
    { id: "h4", name: "Mr. Rohan Das", role: "sound engineer" },
    { id: "h5", name: "Professor Lena Ortiz", role: "faculty advisor" },
  ],
  "startup-office": [
    { id: "h1", name: "Ms. Maya Chen", role: "CTO" },
    { id: "h2", name: "Mr. Dev Patel", role: "founder" },
    { id: "h3", name: "Sam Rivera", role: "intern" },
    { id: "h4", name: "Ms. Grace Liu", role: "investor" },
    { id: "h5", name: "Mr. Omar Haddad", role: "lead designer" },
  ],
  "hill-hotel": [
    { id: "h1", name: "Mrs. Rosamund Fernandes", role: "hotel owner" },
    { id: "h2", name: "Mr. Thomas Kurian", role: "night manager" },
    { id: "h3", name: "Miss Leela Iyer", role: "travel writer" },
    { id: "h4", name: "Dr. Harish Menon", role: "retired surgeon" },
    { id: "h5", name: "Mr. Victor Sharma", role: "honeymooner" },
  ],
  "film-premiere": [
    { id: "h1", name: "Ms. Anika Kapoor", role: "lead actress" },
    { id: "h2", name: "Mr. Kabir Malhotra", role: "director" },
    { id: "h3", name: "Miss Tara Sen", role: "stylist" },
    { id: "h4", name: "Mr. Farhan Ali", role: "producer" },
    { id: "h5", name: "Mr. Neil D'Souza", role: "photographer" },
  ],
  newsroom: [
    { id: "h1", name: "Ms. Meera Joshi", role: "political editor" },
    { id: "h2", name: "Mr. Rahul Verma", role: "data analyst" },
    { id: "h3", name: "Miss Sana Qureshi", role: "junior reporter" },
    { id: "h4", name: "Mr. George Mathew", role: "anchor" },
    { id: "h5", name: "Mr. Aditya Rao", role: "intern" },
  ],
};

/** Generated settings borrow the cast of the built-in setting with the same backdrop. */
const SCENE_CAST: Record<SceneStyle, string> = { manor: "manor-1920s", fest: "college-fest", office: "startup-office" };
const castFor = (theme: string) => CAST[theme] ?? CAST[SCENE_CAST[sceneOf(theme)]];

const MOODS: Expression[] = ["smug", "nervous", "calm", "surprised", "angry", "thinking", "sad", "neutral"];

type Health = { ok: boolean; llmMode: "groq" | "anthropic" | "mock"; redis: boolean; postgres: boolean } | null | "down";

function TitleCast({ theme }: { theme: string }) {
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1900);
    return () => clearInterval(t);
  }, []);
  const cast = castFor(theme);
  return (
    <div className="relative flex items-end justify-center overflow-hidden px-2 pt-6">
      {cast.map((c, i) => {
        const mid = (cast.length - 1) / 2;
        const depth = Math.abs(i - mid);
        return (
          <motion.div
            key={`${theme}-${c.id}`}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: depth * 6 }}
            transition={{ delay: 0.1 * i, type: "spring", stiffness: 120, damping: 16 }}
            className="relative -mx-2.5 sm:-mx-6"
            style={{ zIndex: 10 - Math.round(depth * 2) }}
            onHoverStart={() => setHover(c.id)}
            onHoverEnd={() => setHover(null)}
          >
            <Portrait
              seed={{ ...c, theme }}
              expression={hover === c.id ? "smug" : MOODS[(tick + i * 3) % MOODS.length]}
              size={190}
              className={cx("h-auto drop-shadow-[0_20px_30px_rgb(0_0_0/0.75)]", depth > 1 ? "w-[68px] sm:w-[150px]" : depth > 0 ? "w-[80px] sm:w-[170px]" : "w-[96px] sm:w-[190px]")}
            />
          </motion.div>
        );
      })}
      <div className="table-edge absolute inset-x-0 bottom-0 z-20 h-8 sm:h-10" />
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const createRoom = useGame((s) => s.createRoom);
  const startGame = useGame((s) => s.start);
  const openBoard = useBoardOverlay((s) => s.setOpen);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const library = useThemeLibrary();
  const loadLibrary = library.load;
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<null | "create" | "solo" | "join">(null);
  const [health, setHealth] = useState<Health>(null);

  useEffect(() => {
    setName(getSavedName());
    loadLibrary();
    fetch(`${SERVER_URL}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth("down"));
  }, [loadLibrary]);

  async function generateMore() {
    const fresh = await library.generate().catch(() => []);
    if (fresh[0]) setTheme(fresh[0]);
  }

  const validName = name.trim().length > 0;

  async function create(solo: boolean) {
    if (!validName) return;
    sfx.phase();
    setBusy(solo ? "solo" : "create");
    try {
      const code = await createRoom(name.trim(), themeInput(theme), solo);
      // Solo: the setting is already chosen here, so skip the lobby and start writing the case.
      if (solo) await startGame().catch(() => {});
      router.push(`/room/${code}`);
    } catch {
      setBusy(null);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!validName || code.length !== 6) return;
    sfx.click();
    setBusy("join");
    // Persist the name first; the room page performs the join.
    saveName(name.trim());
    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-dvh pb-24">
      <AnimatePresence mode="wait">
        <motion.div key={theme.id} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} exit={{ opacity: 0.4 }} transition={{ duration: 0.4 }}>
          <Scene theme={theme.id} variant="hero" className="min-h-[640px] border-b border-ink-700/80 lg:min-h-[680px]">
            <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[1fr_420px] lg:pt-10">
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clue-300">A multiplayer deduction game</p>
                  <SoundToggle className="lg:hidden" />
                </div>
                <motion.h1
                  initial={{ opacity: 0, y: 16, letterSpacing: "0.2em" }}
                  animate={{ opacity: 1, y: 0, letterSpacing: "-0.01em" }}
                  transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                  className="mt-3 font-display text-5xl font-extrabold leading-[1] drop-shadow-[0_4px_24px_rgb(0_0_0/0.8)] sm:text-7xl"
                >
                  AI Detective
                  <span className="block bg-gradient-to-r from-blood-400 via-clue-300 to-blood-400 bg-clip-text text-transparent">Murder Mystery</span>
                </motion.h1>
                <p className="mt-4 max-w-xl text-lg text-ink-100/90 drop-shadow">
                  Every suspect is an AI with hidden motives and private memories. Read their faces, question them, confront them with evidence,
                  then name the killer.
                </p>
                <div className="mt-auto pt-8">
                  <TitleCast theme={theme.id} />
                </div>
              </div>

              <motion.section
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="min-w-0 self-start rounded-2xl border border-white/10 bg-ink-950/75 p-5 shadow-2xl backdrop-blur-md sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-ink-300" htmlFor="name">
                    Your detective name
                  </label>
                  <SoundToggle className="hidden lg:grid" />
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-850 px-3 focus-within:border-clue-400/70">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#8a6a1f] text-sm font-bold text-ink-950">
                    {name.trim()[0]?.toUpperCase() ?? "?"}
                  </span>
                  <input
                    id="name"
                    value={name}
                    maxLength={24}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Inspector Rao"
                    className="w-full bg-transparent py-3 text-base outline-none placeholder:text-ink-400"
                  />
                </div>

                <div className="mt-4 grid gap-2">
                  <Button onClick={() => create(true)} disabled={!validName || busy !== null} className="py-3.5 text-base">
                    {busy === "solo" && <Spinner />} Play solo
                  </Button>
                  <Button variant="ghost" onClick={() => create(false)} disabled={!validName || busy !== null} className="py-3">
                    {busy === "create" && <Spinner />} Create a room for friends
                  </Button>
                </div>

                <form onSubmit={join} className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">Or join a room</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={joinCode}
                      maxLength={6}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      placeholder="ROOM CODE"
                      aria-label="Room code"
                      className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 font-mono text-lg tracking-[0.3em] outline-none placeholder:text-ink-400 placeholder:tracking-widest focus:border-clue-400/70"
                    />
                    <Button type="submit" variant="ghost" disabled={!validName || joinCode.length !== 6 || busy !== null}>
                      {busy === "join" && <Spinner />} Join
                    </Button>
                  </div>
                </form>
                {!validName && <p className="mt-3 text-sm text-ink-400">Enter a name to start.</p>}

                <CareerCard className="mt-5" />

                <button
                  type="button"
                  onClick={() => {
                    sfx.click();
                    openBoard(true);
                  }}
                  className="mt-5 flex w-full items-center gap-3 rounded-xl border border-[#6b4423] bg-gradient-to-r from-[#3b2b1d] to-[#2a1d12] p-3 text-left transition hover:border-clue-400/60"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#8a5a32] text-[#f4ead2]">{icons.board}</span>
                  <span className="flex-1">
                    <span className="block font-semibold text-[#f4ead2]">Open the detective board</span>
                    <span className="block text-xs text-[#f4ead2]/60">Pen, eraser, notes and red string. Press B anytime.</span>
                  </span>
                </button>

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-700/70 pt-4 text-xs text-ink-400">
                  {health === null && <span>Checking server...</span>}
                  {health === "down" && <span className="text-blood-400">Can&apos;t reach the game server at {SERVER_URL}. Start it with npm run dev.</span>}
                  {health && health !== "down" && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className={cx("h-1.5 w-1.5 rounded-full", health.llmMode === "mock" ? "bg-clue-400" : "bg-mint-400")} />
                        AI: {health.llmMode === "groq" ? "Groq" : health.llmMode === "anthropic" ? "Claude" : "mock (no API key)"}
                      </span>
                      <span>State: {health.redis ? "Redis" : "in-memory"}</span>
                      <span>History: {health.postgres ? "saved" : "not saved"}</span>
                    </>
                  )}
                </div>
              </motion.section>
            </div>
          </Scene>
        </motion.div>
      </AnimatePresence>

      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
        <p className="font-type text-xs uppercase tracking-[0.3em] text-clue-400">Choose your setting</p>
        <h2 className="mb-4 font-display text-3xl font-bold">Where did it happen?</h2>
        <ThemePicker
          themes={allThemes(library.generated, theme)}
          value={theme.id}
          onChange={setTheme}
          onGenerate={() => void generateMore()}
          generating={library.generating}
        />
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
        <p className="font-type text-xs uppercase tracking-[0.3em] text-clue-400">How a case plays</p>
        <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STEPS.map(([title, sub], i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.06 }}
              className="paper relative rounded-sm p-3 shadow-lg"
              style={{ rotate: `${i % 2 ? 1 : -1}deg` }}
            >
              <span className="font-type text-xs text-blood-500">0{i + 1}</span>
              <span className="block font-display font-bold">{title}</span>
              <span className="block text-xs opacity-70">{sub}</span>
            </motion.li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-ink-400">
          {THEMES.length} settings, plus as many as the AI can invent · a fresh case every game · 4-5 suspects · solo or up to 6 detectives
        </p>
      </section>
      <Toasts />
    </main>
  );
}
