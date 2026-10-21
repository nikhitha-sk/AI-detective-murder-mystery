# AI Detective Murder Mystery

A real-time multiplayer deduction game in which every suspect is an LLM agent with hidden motives and private memories. Players join a room, question the suspects in plain language (publicly or privately), confront them with evidence that unlocks between rounds, compare notes on a shared pinboard, and then vote on who did it.

```
Lobby -> Briefing -> Interrogation x3 -> Discussion -> Accusation vote -> Reveal
```

## Features (MVP from the spec)

| Feature | Where |
|---|---|
| Rooms (6-character code, 2-6 players, host starts) and solo mode | `apps/server/src/game/engine.ts`, `apps/web/src/app/page.tsx` |
| Generated cases from a setting (six built in: 1920s manor, college fest, startup office, hill station hotel, film premiere, election night newsroom), validated with Zod, rule-checked, and verified by an independent **solver agent** (regenerated up to 3 times) | `apps/server/src/case/*` |
| **Generate new settings**: a button at the end of the setting picker asks the AI for 3 fresh settings, as often as you like (kept in your browser) | `case/themes.ts`, `ThemePicker.tsx`, `lib/themes.ts` |
| Interrogation: public or private questions, in-character replies that stay consistent with earlier statements | `apps/server/src/agents/*` |
| Suspect behaviour: alibis, red-herring secrets for innocents, lies from the killer, a **stress level** that rises under evidence and makes slips more likely | `apps/server/src/game/rules.ts`, `agents/prompts.ts` |
| Evidence board: clues unlock each round; present a clue to a suspect | `Interrogation.tsx` |
| Shared notes: a pinboard where players drag suspects, clues and notes (synced live) | `Pinboard.tsx` |
| Vote and reveal: the true timeline, which clues pointed to the killer, everyone's secrets, and who was closest | `Reveal.tsx` |
| Fair-use limits: question budget per player per round, per-room token budget, 3-second ask cooldown | `engine.ts` |

### How the game stays fair (rules in code, not just prompts)

- **Context isolation.** Each suspect agent's prompt is built only from its own *slice* (persona, own timeline, alibi, secret and witness memories) plus its own memory. No agent ever receives the full case, other suspects' secrets, locked clues, or other suspects' conversations. Tests enforce this (`test/case.test.ts`).
- **Consistency.** Suspects receive their own prior statements (long histories are summarised by the small model), and the guard checks each new reply against them.
- **The confession is a game event.** The server allows it only when the killer's stress is at or above 80 *and* a key clue has been put in front of them. Otherwise the code-level guard blocks any confession, whatever the model writes.
- **Prompt-injection defence.** Player text is sanitised and passed as quoted in-world dialogue. Every draft goes through a deterministic code check (confession, character break, innocent "knowing" the killer) and then a small guard model (leaks, contradictions). A rejected draft is regenerated once with feedback, then replaced by an in-character deflection.
- **Solvability.** A case is played only if a separate solver, given just the public facts, the claimed alibis and the clue text, names the right killer.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS 4, Zustand, Socket.IO client, Framer Motion |
| Game server | Node.js + TypeScript, Socket.IO, XState (phase machine) |
| Live state | Redis + `@socket.io/redis-adapter` (rooms, suspect memory, rate limits, locks); in-memory fallback |
| Database | PostgreSQL with Drizzle ORM (cases, games, transcripts, votes, results) |
| LLM | Groq (free tier) by default: `openai/gpt-oss-120b` for cases and the solver, `qwen/qwen3.8-27b` for suspects, `openai/gpt-oss-20b` for the guard and summaries. Anthropic Claude is also supported. Structured JSON output, validated with Zod |
| Deploy | Docker and docker compose |

## Project layout

```
.
├── apps/
│   ├── server/                 # Node + Socket.IO game server
│   │   ├── src/
│   │   │   ├── index.ts        # HTTP + Socket.IO bootstrap, event handlers
│   │   │   ├── config.ts       # env parsing and game rules
│   │   │   ├── store.ts        # Redis / in-memory store + distributed locks
│   │   │   ├── game/           # engine, XState phase machine, rules, state
│   │   │   ├── case/           # generator, rule checks, slices, seeds
│   │   │   ├── agents/         # prompts, suspect turn pipeline, reply guard
│   │   │   ├── llm/            # Claude provider, mock provider + hand-written cases
│   │   │   ├── db/             # Drizzle schema + persistence
│   │   │   └── scripts/        # cli.ts, eval.ts, migrate.ts
│   │   ├── drizzle/            # SQL migrations
│   │   └── test/               # vitest suites
│   └── web/                    # Next.js client
│       └── src/{app,components,store,lib}
├── packages/shared/            # Zod schemas, socket event types, public views
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- **Node.js 20.12+** (tested on 22)
- **Docker Desktop**, for Postgres and Redis. Both are optional (see below), but needed for the full setup.
- An **Anthropic API key** if you want real AI suspects. Without one, the game runs in **mock mode**: hand-written cases and rule-based suspects, no cost.

## Ports

| Service | Port |
|---|---|
| Web app (Next.js) | **3300** |
| Game server (Socket.IO) | **4300** |
| PostgreSQL (Docker) | **55432** |
| Redis (Docker) | **56379** |

These are deliberately non-default, so they don't clash with other local projects or a native Postgres on 5432.

## Running the project

```bash
# 1. Install dependencies (from the repo root)
npm install

# 2. Create your environment file
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
#    then put your free Groq key in .env:  GROQ_API_KEY=gsk_...
#    (get one at https://console.groq.com/keys; leave it empty to play in mock mode)

# 3. Start Postgres and Redis
npm run infra:up

# 4. Start the game server and the web app together
npm run dev
```

Open **http://localhost:3300**, enter a name, and choose **Play solo** (or **Create a room** and share the code). The server applies database migrations on startup.

To stop: press `Ctrl+C` for the dev servers, then run `npm run infra:down` to stop the containers. Data is kept in a Docker volume.

### Without Docker

Leave `REDIS_URL` and `DATABASE_URL` empty in `.env`. The server then uses an in-memory store (single instance) and skips persistence. The game still works.

### Everything in containers

```bash
docker compose --profile app up --build
```

This builds and runs the server and web images alongside Postgres and Redis. It passes `GROQ_API_KEY` (and `ANTHROPIC_API_KEY`) through from `.env` or your shell.

### Production build (without Docker)

```bash
npm run build      # builds the Next.js app
npm run start      # runs the server and the built web app
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server (watch mode) and web app together |
| `npm run infra:up` / `infra:down` | Start or stop Postgres and Redis containers |
| `npm run db:migrate` | Apply migrations manually (they also run on server start) |
| `npm run cli -- --theme manor-1920s` | Terminal interrogation through the real engine. Commands: `/talk n`, `/clues`, `/present c3`, `/next`, `/vote n` |
| `npm run eval -- --n 5 [--theme college-fest] [--redteam]` | Generates N cases per theme and reports solvable rate, first-try solver pass rate and cost. `--redteam` also attacks each killer with prompt injections and counts confessions |
| `npm test` | Server unit and integration tests (vitest) |
| `npm run typecheck` | TypeScript check across all workspaces |

## Configuration (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `auto` | `auto` uses Groq if `GROQ_API_KEY` is set, else Claude if `ANTHROPIC_API_KEY` is set, otherwise mock. Force with `groq` / `anthropic` / `mock` |
| `GROQ_API_KEY` | (empty) | Your Groq API key (free at https://console.groq.com/keys) |
| `ANTHROPIC_API_KEY` | (empty) | Your Claude API key |
| `MODEL_MAIN` | Groq: `openai/gpt-oss-120b`, Claude: `claude-opus-5-5` | Case generation |
| `MODEL_SOLVER` | Groq: `openai/gpt-oss-20b`, Claude: `claude-opus-5-5` | Fairness check on each new case. On Groq keep it different from `MODEL_MAIN`: each model has its own 8k tokens/min free-tier limit, and generation plus solving on one model overruns it |
| `MODEL_SUSPECT` | Groq: `qwen/qwen3.8-27b`, Claude: `claude-opus-5-5` | Suspect replies |
| `MODEL_GUARD` | Groq: `openai/gpt-oss-20b`, Claude: `claude-haiku-5-5` | Reply guard, memory summaries and new settings |
| `REDIS_URL` | `redis://localhost:56379` | Empty = in-memory store |
| `DATABASE_URL` | `postgres://mystery:mystery@localhost:55432/mystery` | Empty = no persistence |
| `ROUNDS`, `BRIEFING_SECONDS`, `ROUND_SECONDS`, `DISCUSSION_SECONDS`, `VOTE_SECONDS` | 3, 60, 240, 120, 60 | Phase timers. The host can also skip ahead |
| `QUESTIONS_PER_ROUND` | 6 | Per player, per round. Presenting evidence counts as a question |
| `ROOM_TOKEN_BUDGET` | 600000 | Questioning stops once a room has used this many tokens |

The web app reads `NEXT_PUBLIC_SERVER_URL` (default `http://localhost:4300`). To point it elsewhere, put it in `apps/web/.env.local`.

## Socket.IO events

- **Client to server:** `room:create`, `room:join`, `room:leave`, `room:setTheme`, `game:start`, `game:advance` (host skip), `game:restart`, `ask {suspectId, text, private}`, `present {suspectId, clueId, text?, private}`, `vote {suspectId}`, `notes:add|move|remove`
- **Server to client:** `room:state`, `phase:changed`, `reply:pending`, `reply:chunk`, `reply:done`, `reply:failed`, `clue:unlocked`, `suspect:update`, `budget:update`, `messages:sync`, `notes:sync`, `reveal`, `server:error`

Typed contracts live in `packages/shared/src/events.ts`.

## Data model

- **Postgres:** `cases` (ground truth JSONB, solver attempts, solve rate), `games` (players, votes, winner, duration, tokens, cost), `messages` (full transcript with visibility, deflections, confessions).
- **Redis:** `room:{code}` (phase machine state, round, timers, host, players, budgets, votes), `case:{code}` (ground truth, server-only), `slice:{code}:{id}`, `suspect:{code}:{id}` (stress, statements, evidence seen, summary), `msgs:{code}`, `notes:{code}`.

## Troubleshooting

- **"Can't reach the game server"** on the home page: the server isn't running on 4300. Run `npm run dev` and check its log.
- **Port already in use:** change the left-hand port in `docker-compose.yml` and the matching URL in `.env`.
- **`[db] could not connect`**: Postgres isn't up yet. Run `npm run infra:up`. The game keeps working without persistence.
- **Suspects answer "(evasive)" all the time:** the guard keeps rejecting drafts, or the API is failing. Check the server log for `[suspect ...] reply failed` (often an invalid API key).

## Not built yet (stretch goals from the spec)

Voice interrogation, the AI detective partner, generated suspect portraits, shareable transcripts and spectator mode, and the Godot client.
