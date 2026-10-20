/**
 * Terminal interrogation (build plan, week 1). Runs the real game engine with
 * an in-memory store: generates a case, then lets you question suspects.
 *
 *   npm run cli                       # random theme
 *   npm run cli -- --theme startup-office
 */
import readline from "node:readline/promises";
import { THEME_IDS, type ChatMessage, type RevealPayload, type RoomView } from "@mystery/shared";
import { config } from "../config";
import { createPersistence } from "../db";
import { GameEngine, GameError } from "../game/engine";
import { createLlm } from "../llm";
import { MemoryStore } from "../store";

const args = process.argv.slice(2);
const themeArg = args[args.indexOf("--theme") + 1];
const theme = args.includes("--theme") && (THEME_IDS as readonly string[]).includes(themeArg)
  ? themeArg
  : THEME_IDS[Math.floor(Math.random() * THEME_IDS.length)];

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  purple: (s: string) => `\x1b[35m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

// Assigned from event callbacks; the assertion stops TS narrowing it to `null`.
let state = null as RoomView | null;
let waiting: ((m: ChatMessage | null) => void) | null = null;

const llm = createLlm(config);
const engine = new GameEngine({
  store: new MemoryStore(),
  llm,
  db: await createPersistence(undefined),
  rules: { ...config.rules, questionsPerRound: 999, askCooldownSeconds: 0, roundSeconds: 86_400, briefingSeconds: 86_400 },
  typewriterMs: 0,
  out: {
    room: (_code, event, ...args) => onEvent(event, args[0]),
    player: (_id, event, ...args) => onEvent(event, args[0]),
  },
});

function onEvent(event: string, payload: unknown) {
  switch (event) {
    case "room:state":
      state = payload as RoomView;
      break;
    case "clue:unlocked":
      for (const clue of payload as { id: string; text: string }[]) console.log(c.yellow(`  [new clue ${clue.id}] ${clue.text}`));
      break;
    case "reply:chunk":
      process.stdout.write((payload as { delta: string }).delta);
      break;
    case "reply:done": {
      const m = payload as ChatMessage;
      process.stdout.write("\n");
      if (m.deflected) console.log(c.dim("  (the guard rejected the draft; this is a deflection)"));
      if (m.confession) console.log(c.red("  *** CONFESSION ***"));
      waiting?.(m);
      break;
    }
    case "reply:failed":
      console.log(c.red("  (no reply)"));
      waiting?.(null);
      break;
    case "reveal": {
      const r = payload as RevealPayload;
      console.log(c.bold(`\n=== THE REVEAL ===\nThe killer was ${r.killerName}.`));
      console.log(r.summary);
      for (const e of r.timeline) console.log(c.dim(`  ${e.t}  ${e.event}`));
      console.log(r.playersWon ? c.green("\nYou solved it!") : c.red("\nThe killer got away."));
      console.log(c.dim(`Tokens: ${r.stats.tokens}, cost: $${r.stats.costUsd.toFixed(4)}`));
      break;
    }
  }
}

const PLAYER = "cli-player-0001";
const code = await engine.createRoom(PLAYER, "Detective", theme, true);
console.log(c.purple(`\nGenerating a "${theme}" case with ${llm.mode === "mock" ? "the mock provider" : config.modelMain}...`));
await engine.start(code, PLAYER);

while (!state || state.phase === "lobby" || state.phase === "generating") {
  await new Promise((r) => setTimeout(r, 300));
  if (state?.generation.status === "failed") {
    console.error(c.red(state.generation.message));
    process.exit(1);
  }
}

const view = state as RoomView;
const kase = view.case!;
console.log(`\n${c.bold(kase.title)}\n${kase.setting}\n`);
console.log(`${c.bold("Victim:")} ${kase.victim.name} - ${kase.victim.description}`);
console.log(`${c.bold("Cause:")} ${kase.victim.cause}, around ${kase.victim.timeOfDeath}. ${kase.victim.scene}\n`);
kase.suspects.forEach((s, i) => console.log(`  ${i + 1}. ${c.bold(s.name)}, ${s.role} - ${s.bio}`));
console.log(
  c.dim(`\nCommands: /talk <n>  /clues  /present <clueId> [words]  /next (next round)  /vote <n>  /quit\nAnything else is said to the current suspect.\n`),
);

await engine.advance(code, PLAYER); // briefing -> round 1
let current = kase.suspects[0];
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function waitForReply(start: () => Promise<string>) {
  const done = new Promise<ChatMessage | null>((r) => (waiting = r));
  process.stdout.write(c.purple(`${current.name}: `));
  await start();
  await done;
  waiting = null;
}

const prompt = () => process.stdout.write(c.green(`\n[round ${state!.round}] you -> ${current.name}: `));
prompt();
// The async iterator buffers lines typed (or piped) while a reply is still arriving.
for await (const raw of rl) {
  const line = raw.trim();
  if (!line) {
    prompt();
    continue;
  }
  if (!process.stdin.isTTY) console.log(line);
  try {
    if (line === "/quit") break;
    if (line.startsWith("/talk")) {
      const n = Number(line.split(/\s+/)[1]) - 1;
      if (kase.suspects[n]) current = kase.suspects[n];
    } else if (line === "/clues") {
      for (const clue of state!.clues) console.log(`  ${clue.id} (round ${clue.round}): ${clue.text}`);
      const s = state!.case!.suspects.map((x) => `${x.name.split(" ")[0]} ${x.stress}`).join(", ");
      console.log(c.dim(`  stress: ${s}`));
    } else if (line === "/next") {
      await engine.advance(code, PLAYER);
      console.log(c.yellow(`  -> ${state!.phase}${state!.phase === "interrogation" ? ` round ${state!.round}` : ""}`));
    } else if (line.startsWith("/present")) {
      const [, clueId, ...rest] = line.split(/\s+/);
      await waitForReply(() => engine.present(code, PLAYER, { suspectId: current.id, clueId, text: rest.join(" "), private: false }));
    } else if (line.startsWith("/vote")) {
      const n = Number(line.split(/\s+/)[1]) - 1;
      while (state!.phase !== "voting") await engine.advance(code, PLAYER);
      await engine.vote(code, PLAYER, kase.suspects[n]?.id ?? "");
      break;
    } else {
      await waitForReply(() => engine.ask(code, PLAYER, { suspectId: current.id, text: line, private: false }));
    }
  } catch (err) {
    console.log(c.red(`  ${err instanceof GameError ? err.message : String(err)}`));
  }
  prompt();
}

rl.close();
process.exit(0);
