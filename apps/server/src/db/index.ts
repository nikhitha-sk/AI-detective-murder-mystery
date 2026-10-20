import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseFile, ChatMessage } from "@mystery/shared";
import { eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

/**
 * Durable record of cases, games and transcripts. Writes are queued and never
 * block or break a running game: live state is in Redis, Postgres is history.
 */
export interface Persistence {
  readonly enabled: boolean;
  saveCase(id: string, c: CaseFile, solverAttempts: number, llmMode: string): void;
  createGame(id: string, caseId: string, roomCode: string, players: { id: string; name: string }[]): void;
  saveMessage(gameId: string, m: ChatMessage): void;
  finishGame(
    gameId: string,
    caseId: string,
    result: { votes: Record<string, string>; solved: boolean; durationSec: number; tokens: number; costUsd: number },
  ): void;
  close(): Promise<void>;
}

class NullPersistence implements Persistence {
  readonly enabled = false;
  saveCase() {}
  createGame() {}
  saveMessage() {}
  finishGame() {}
  async close() {}
}

class PgPersistence implements Persistence {
  readonly enabled = true;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private pool: pg.Pool,
    private db: NodePgDatabase<typeof schema>,
  ) {}

  private enqueue(label: string, fn: () => Promise<unknown>) {
    this.queue = this.queue.then(fn).catch((err) => console.error(`[db] ${label} failed:`, err?.message ?? err));
  }

  saveCase(id: string, c: CaseFile, solverAttempts: number, llmMode: string) {
    this.enqueue("saveCase", () =>
      this.db.insert(schema.cases).values({ id, theme: c.theme, title: c.title, groundTruth: c, solverAttempts, llmMode }),
    );
  }

  createGame(id: string, caseId: string, roomCode: string, players: { id: string; name: string }[]) {
    this.enqueue("createGame", () => this.db.insert(schema.games).values({ id, caseId, roomCode, players }));
  }

  saveMessage(gameId: string, m: ChatMessage) {
    this.enqueue("saveMessage", () =>
      this.db.insert(schema.messages).values({
        id: m.id,
        gameId,
        suspectId: m.suspectId,
        playerId: m.askerId,
        visibility: m.visibility,
        kind: m.kind,
        question: m.question,
        clueId: m.clueId,
        reply: m.reply,
        round: m.round,
        deflected: m.deflected,
        confession: m.confession,
        ts: new Date(m.ts),
      }),
    );
  }

  finishGame(
    gameId: string,
    caseId: string,
    r: { votes: Record<string, string>; solved: boolean; durationSec: number; tokens: number; costUsd: number },
  ) {
    this.enqueue("finishGame", async () => {
      await this.db
        .update(schema.games)
        .set({
          votes: r.votes,
          winner: r.solved ? "players" : "killer",
          durationSec: r.durationSec,
          tokens: r.tokens,
          costUsd: r.costUsd,
          finishedAt: new Date(),
        })
        .where(eq(schema.games.id, gameId));
      await this.db
        .update(schema.cases)
        .set({
          gamesPlayed: sql`${schema.cases.gamesPlayed} + 1`,
          gamesSolved: sql`${schema.cases.gamesSolved} + ${r.solved ? 1 : 0}`,
          solveRate: sql`(${schema.cases.gamesSolved} + ${r.solved ? 1 : 0})::real / (${schema.cases.gamesPlayed} + 1)`,
        })
        .where(eq(schema.cases.id, caseId));
    });
  }

  async close() {
    await this.queue;
    await this.pool.end();
  }
}

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

export async function createPersistence(databaseUrl: string | undefined): Promise<Persistence> {
  if (!databaseUrl) {
    console.warn("[db] DATABASE_URL not set: cases, games and transcripts will not be saved.");
    return new NullPersistence();
  }
  try {
    await runMigrations(databaseUrl);
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
    console.log("[db] connected to PostgreSQL, migrations applied");
    return new PgPersistence(pool, drizzle(pool, { schema }));
  } catch (err) {
    console.error(
      "[db] could not connect to PostgreSQL - continuing without persistence:",
      err instanceof Error ? err.message : err,
    );
    return new NullPersistence();
  }
}
