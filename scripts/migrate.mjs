// npm run db:migrate
// Reads schema.sql and runs it against the database.
// Requires DATABASE_URL to be set in your environment (or .env file).

import { readFileSync } from "fs";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

config(); // load .env

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, "../schema.sql"), "utf8");

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

console.log("Running schema migration…");
await sql.unsafe(schema);
await sql.end();
console.log("Done.");
