import { boolean, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey(),
  theme: text("theme").notNull(),
  title: text("title").notNull(),
  groundTruth: jsonb("ground_truth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  /** Share of finished games in which the players' vote named the killer. */
  solveRate: real("solve_rate"),
  gamesPlayed: integer("games_played").default(0).notNull(),
  gamesSolved: integer("games_solved").default(0).notNull(),
  /** Generation attempts needed before the solver cracked it. */
  solverAttempts: integer("solver_attempts").notNull(),
  llmMode: text("llm_mode").notNull(),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id")
    .references(() => cases.id)
    .notNull(),
  roomCode: text("room_code").notNull(),
  players: jsonb("players").notNull(),
  votes: jsonb("votes"),
  /** "players" if the vote named the killer, otherwise "killer". */
  winner: text("winner"),
  durationSec: integer("duration_sec"),
  tokens: integer("tokens"),
  costUsd: real("cost_usd"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey(),
  gameId: uuid("game_id")
    .references(() => games.id)
    .notNull(),
  suspectId: text("suspect_id").notNull(),
  playerId: text("player_id").notNull(),
  visibility: text("visibility").notNull(),
  kind: text("kind").notNull(),
  question: text("question").notNull(),
  clueId: text("clue_id"),
  reply: text("reply").notNull(),
  round: integer("round").notNull(),
  deflected: boolean("deflected").notNull(),
  confession: boolean("confession").notNull(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
});
