"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Briefing } from "@/components/Briefing";
import { Discussion } from "@/components/Discussion";
import { Generating } from "@/components/Generating";
import { Interrogation } from "@/components/Interrogation";
import { Lobby } from "@/components/Lobby";
import { PhaseBanner } from "@/components/PhaseBanner";
import { Reveal } from "@/components/Reveal";
import { RoomHeader } from "@/components/RoomHeader";
import { Scene } from "@/components/Scene";
import { Button, Spinner, Toasts } from "@/components/ui";
import { Voting } from "@/components/Voting";
import { getSavedName } from "@/lib/identity";
import { useGame } from "@/store/game";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const joinRoom = useGame((s) => s.joinRoom);
  const view = useGame((s) => s.view);
  const connected = useGame((s) => s.connected);
  const [name, setName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const joined = useRef(false);

  useEffect(() => {
    setName(getSavedName() || "");
  }, []);

  useEffect(() => {
    if (!name || joined.current) return;
    joined.current = true;
    joinRoom(code, name).catch((err: Error) => setError(err.message));
  }, [code, name, joinRoom]);

  if (name === null) return null;

  if (!name) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <form
          className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (draftName.trim()) setName(draftName.trim());
          }}
        >
          <h1 className="font-display text-2xl font-bold">Joining room {code}</h1>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-ink-300" htmlFor="n">
            Your detective name
          </label>
          <input
            id="n"
            autoFocus
            maxLength={24}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-850 px-4 py-3 outline-none focus:border-plum-500"
          />
          <Button type="submit" className="mt-4 w-full" disabled={!draftName.trim()}>
            Join
          </Button>
        </form>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6 text-center">
          <h1 className="font-display text-2xl font-bold">Couldn&apos;t join {code}</h1>
          <p className="mt-2 text-ink-300">{error}</p>
          <Link href="/" className="mt-5 inline-block">
            <Button variant="ghost">Back to the start</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="grid min-h-dvh place-items-center text-ink-300">
        <p className="flex items-center gap-3">
          <Spinner /> {connected ? `Joining room ${code}...` : "Connecting to the game server..."}
        </p>
        <Toasts />
      </main>
    );
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-30" aria-hidden>
        <Scene theme={view.theme} variant="backdrop" className="h-full" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-ink-950/40 via-ink-950/70 to-ink-950" aria-hidden />
      <RoomHeader />
      <PhaseBanner />
      <main className="relative z-10 mx-auto w-full max-w-[1500px] flex-1 px-3 pb-20 pt-4 sm:px-5">
        {view.phase === "lobby" && <Lobby />}
        {view.phase === "generating" && <Generating />}
        {view.phase === "briefing" && <Briefing />}
        {view.phase === "interrogation" && <Interrogation />}
        {view.phase === "discussion" && <Discussion />}
        {view.phase === "voting" && <Voting />}
        {view.phase === "reveal" && <Reveal />}
      </main>
      <Toasts />
    </div>
  );
}
