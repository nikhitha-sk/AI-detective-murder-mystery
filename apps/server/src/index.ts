import { createServer } from "node:http";
import {
  AskSchema,
  NoteAddSchema,
  NoteMoveSchema,
  NoteRemoveSchema,
  PresentSchema,
  RoomCreateSchema,
  RoomJoinSchema,
  SetThemeSchema,
  VoteSchema,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@mystery/shared";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server, type Socket } from "socket.io";
import { ZodError } from "zod";
import { config } from "./config";
import { createPersistence } from "./db";
import { GameEngine, GameError } from "./game/engine";
import { createLlm } from "./llm";
import { LockTimeoutError, RedisStore, createStore } from "./store";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const PLAYER_ID = /^[A-Za-z0-9_-]{8,64}$/;

const store = await createStore(config.redisUrl);
const db = await createPersistence(config.databaseUrl);
const llm = createLlm(config);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(
      JSON.stringify({
        ok: true,
        llmMode: llm.mode,
        models:
          llm.mode === "mock" ? null : { main: config.modelMain, suspect: config.modelSuspect, guard: config.modelGuard },
        redis: store instanceof RedisStore,
        postgres: db.enabled,
      }),
    );
    return;
  }
  res.writeHead(404).end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: config.clientOrigins, credentials: true },
});

if (store instanceof RedisStore) {
  // Lets rooms span several server instances.
  const pub = store.redis.duplicate();
  const sub = store.redis.duplicate();
  io.adapter(createAdapter(pub, sub));
}

const playerRoom = (id: string) => `p:${id}`;

const engine = new GameEngine({
  store,
  llm,
  db,
  rules: config.rules,
  out: {
    room: (code, event, ...args) => io.to(code).emit(event, ...args),
    player: (id, event, ...args) => io.to(playerRoom(id)).emit(event, ...args),
  },
});

function errorMessage(err: unknown): string {
  if (err instanceof GameError) return err.message;
  if (err instanceof ZodError) return err.issues[0]?.message ?? "Invalid input.";
  if (err instanceof LockTimeoutError) return "The server is busy, please try again.";
  console.error("[socket] unexpected error:", err);
  return "Something went wrong on the server.";
}

/** Wrap a handler: validate, run, ack the result, and turn errors into friendly messages. */
function handle<T>(socket: GameSocket, fn: () => Promise<T>, ack?: Ack<T>) {
  fn()
    .then((data) => ack?.({ ok: true, data }))
    .catch((err) => {
      const error = errorMessage(err);
      if (ack) ack({ ok: false, error });
      else socket.emit("server:error", { message: error });
    });
}

function currentRoom(socket: GameSocket): string {
  if (!socket.data.code) throw new GameError("Join a room first.");
  return socket.data.code;
}

io.use((socket, next) => {
  const playerId = socket.handshake.auth?.playerId;
  if (typeof playerId !== "string" || !PLAYER_ID.test(playerId)) return next(new Error("invalid player id"));
  socket.data.playerId = playerId;
  socket.data.code = null;
  next();
});

io.on("connection", (socket: GameSocket) => {
  const playerId = socket.data.playerId;
  void socket.join(playerRoom(playerId));

  const enterRoom = async (code: string) => {
    if (socket.data.code && socket.data.code !== code) await socket.leave(socket.data.code);
    socket.data.code = code;
    await socket.join(code);
    await engine.syncPlayer(code, playerId);
  };

  socket.on("room:create", (input, ack) =>
    handle(
      socket,
      async () => {
        const { name, theme, solo } = RoomCreateSchema.parse(input);
        const code = await engine.createRoom(playerId, name, theme, solo);
        await enterRoom(code);
        return { code };
      },
      ack,
    ),
  );

  socket.on("room:join", (input, ack) =>
    handle(
      socket,
      async () => {
        const { code, name } = RoomJoinSchema.parse(input);
        await engine.joinRoom(playerId, name, code);
        await enterRoom(code);
        return { code };
      },
      ack,
    ),
  );

  socket.on("room:leave", () =>
    handle(socket, async () => {
      const code = socket.data.code;
      if (!code) return;
      socket.data.code = null;
      await socket.leave(code);
      await engine.leave(code, playerId);
    }),
  );

  socket.on("room:setTheme", (input, ack) =>
    handle(socket, async () => engine.setTheme(currentRoom(socket), playerId, SetThemeSchema.parse(input).theme), ack),
  );
  socket.on("game:start", (ack) => handle(socket, async () => engine.start(currentRoom(socket), playerId), ack));
  socket.on("game:advance", (ack) => handle(socket, async () => engine.advance(currentRoom(socket), playerId), ack));
  socket.on("game:restart", (ack) => handle(socket, async () => engine.restart(currentRoom(socket), playerId), ack));

  socket.on("ask", (input, ack) =>
    handle(
      socket,
      async () => ({ messageId: await engine.ask(currentRoom(socket), playerId, AskSchema.parse(input)) }),
      ack,
    ),
  );
  socket.on("present", (input, ack) =>
    handle(
      socket,
      async () => ({ messageId: await engine.present(currentRoom(socket), playerId, PresentSchema.parse(input)) }),
      ack,
    ),
  );
  socket.on("vote", (input, ack) =>
    handle(socket, async () => engine.vote(currentRoom(socket), playerId, VoteSchema.parse(input).suspectId), ack),
  );

  socket.on("notes:add", (input, ack) =>
    handle(socket, async () => engine.addNote(currentRoom(socket), playerId, NoteAddSchema.parse(input)), ack),
  );
  socket.on("notes:move", (input) =>
    handle(socket, async () => engine.moveNote(currentRoom(socket), NoteMoveSchema.parse(input))),
  );
  socket.on("notes:remove", (input) =>
    handle(socket, async () => engine.removeNote(currentRoom(socket), NoteRemoveSchema.parse(input).id)),
  );

  socket.on("disconnect", async () => {
    const code = socket.data.code;
    if (!code) return;
    // Only mark the player away when their last tab/socket is gone.
    const remaining = await io.in(playerRoom(playerId)).fetchSockets();
    if (remaining.length === 0) await engine.disconnect(code, playerId).catch(() => {});
  });
});

// Phase timers: every instance ticks; the room lock makes sure only one advances a room.
const ticker = setInterval(() => void engine.tick().catch((err) => console.error("[tick]", err)), 1000);

httpServer.listen(config.port, () => {
  console.log(`\n  AI Detective game server on http://localhost:${config.port}`);
  console.log(
    `  LLM: ${
      llm.mode === "mock"
        ? "mock (no API key - hand-written cases)"
        : `${llm.mode === "groq" ? "Groq" : "Claude"} (main ${config.modelMain}, suspects ${config.modelSuspect}, guard ${config.modelGuard})`
    }`,
  );
  console.log(`  Live state: ${store instanceof RedisStore ? "Redis" : "in-memory"}   Persistence: ${db.enabled ? "PostgreSQL" : "off"}\n`);
});

async function shutdown() {
  clearInterval(ticker);
  io.close();
  await db.close();
  await store.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
