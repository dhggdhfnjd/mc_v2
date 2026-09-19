// Bun entry point: runs the Cloudflare Worker in src/index.ts on the hackathon server, over a
// SQLite file instead of D1. src/index.ts is not modified; this file only supplies the slice of
// the D1 API it uses (prepare → bind → first / all / run) and a plain HTTP listener.
//
//   DB_PATH=/srv/mizani-api/data/mizani.db PORT=8787 bun run server.ts
//
// Caddy strips /api and proxies here, so the widget and the API share one origin. It sits outside
// src/ so the Cloudflare tsconfig (src/** only) never type-checks Bun-only APIs.
import { Database } from "bun:sqlite";
import worker, { type Env } from "./src/index";

const DB_PATH = process.env.DB_PATH ?? "./mizani.db";
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8787);

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");
// D1 enforces foreign keys; plain SQLite only does when asked, once per connection
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");

// schema.sql is idempotent (CREATE … IF NOT EXISTS). Split it ourselves so this never depends on
// whether the driver accepts several statements in one call.
const schema = await Bun.file(new URL("./schema.sql", import.meta.url)).text();
for (const statement of schema.replace(/--[^\n]*/g, "").split(";")) {
  if (statement.trim()) db.exec(statement);
}

type Value = string | number | bigint | boolean | null | Uint8Array;

function prepare(sql: string) {
  const statement = db.query(sql);
  let args: Value[] = [];
  const bound = {
    bind(...values: Value[]) {
      args = values;
      return bound;
    },
    async first<T>(): Promise<T | null> {
      return (statement.get(...args) as T | null) ?? null;
    },
    async all<T>(): Promise<{ results: T[]; success: true }> {
      return { results: statement.all(...args) as T[], success: true };
    },
    async run(): Promise<{ success: true }> {
      statement.run(...args);
      return { success: true };
    },
  };
  return bound;
}

const env = {
  DB: { prepare } as unknown as Env["DB"],
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? "https://203-116-30-132.sslip.io",
} satisfies Env;

Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: (request) => worker.fetch(request, env),
});

console.log(`mizani-api on http://${HOST}:${PORT}, database ${DB_PATH}`);
