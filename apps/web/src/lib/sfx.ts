"use client";

import { useSyncExternalStore } from "react";

/** Tiny synthesized sound effects (Web Audio, no files). Muting is remembered per browser. */

const MUTE_KEY = "ai-detective:muted";
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(opts.gain ?? 0.08, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { gain?: number; filter?: number; delay?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = opts.filter ?? 800;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.2;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

let lastType = 0;

export const sfx = {
  click: () => tone(660, 0.06, { type: "triangle", gain: 0.05 }),
  /** Typewriter key; throttled so long replies don't buzz. */
  type() {
    const now = performance.now();
    if (now - lastType < 55) return;
    lastType = now;
    noise(0.03, { gain: 0.06, filter: 3200 });
  },
  clue() {
    tone(784, 0.18, { gain: 0.06 });
    tone(1175, 0.3, { gain: 0.05, delay: 0.12 });
  },
  present: () => noise(0.12, { gain: 0.22, filter: 600 }),
  stamp() {
    noise(0.18, { gain: 0.35, filter: 400 });
    tone(90, 0.2, { type: "square", gain: 0.05 });
  },
  thunder() {
    noise(2.2, { gain: 0.5, filter: 220 });
    noise(1.2, { gain: 0.25, filter: 500, delay: 0.15 });
  },
  phase() {
    tone(220, 0.6, { type: "sawtooth", gain: 0.03, slideTo: 110 });
    tone(330, 0.5, { gain: 0.04, delay: 0.05 });
  },
  tension: () => tone(110, 0.9, { type: "sawtooth", gain: 0.025, slideTo: 82 }),
};

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* not persisted */
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
    () => false,
  );
}
