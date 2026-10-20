CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"theme" text NOT NULL,
	"title" text NOT NULL,
	"ground_truth" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"solve_rate" real,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_solved" integer DEFAULT 0 NOT NULL,
	"solver_attempts" integer NOT NULL,
	"llm_mode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"room_code" text NOT NULL,
	"players" jsonb NOT NULL,
	"votes" jsonb,
	"winner" text,
	"duration_sec" integer,
	"tokens" integer,
	"cost_usd" real,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"suspect_id" text NOT NULL,
	"player_id" text NOT NULL,
	"visibility" text NOT NULL,
	"kind" text NOT NULL,
	"question" text NOT NULL,
	"clue_id" text,
	"reply" text NOT NULL,
	"round" integer NOT NULL,
	"deflected" boolean NOT NULL,
	"confession" boolean NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;