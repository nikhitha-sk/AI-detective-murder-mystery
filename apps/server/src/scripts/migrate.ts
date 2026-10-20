import { config } from "../config";
import { runMigrations } from "../db";

if (!config.databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}
await runMigrations(config.databaseUrl);
console.log("Migrations applied.");
