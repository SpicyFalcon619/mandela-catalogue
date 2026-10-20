import type { Client } from "@libsql/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { backfillYoutubeLinks, seedIfEmpty } from "./seed";

/**
 * Database access. Everything is async so the same code runs on two drivers:
 *  - a local SQLite file (better-sqlite3): development, tests and Docker;
 *  - Turso over HTTP (@libsql/client/web): serverless hosting such as Vercel, where there is no disk.
 * Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) to use Turso; otherwise DATABASE_PATH or ./data/mandela.db.
 * Keep queries to plain SQLite SQL that both drivers accept.
 */
export type Arg = string | number | null;
export type Row = Record<string, unknown>;
export type Stmt = { sql: string; args?: Arg[] };
export interface Db {
  all<T = Row>(sql: string, ...args: Arg[]): Promise<T[]>;
  get<T = Row>(sql: string, ...args: Arg[]): Promise<T | undefined>;
  run(sql: string, ...args: Arg[]): Promise<{ changes: number; lastId: number }>;
  /** All statements in one transaction: all or nothing, and one round trip on Turso. */
  batch(stmts: Stmt[]): Promise<void>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  prefs TEXT NOT NULL DEFAULT '{}',
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tapes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  release_date TEXT NOT NULL,
  runtime TEXT NOT NULL,
  is_main INTEGER NOT NULL DEFAULT 0,
  inworld_label TEXT NOT NULL DEFAULT '',
  inworld_sort REAL,
  confidence TEXT NOT NULL DEFAULT 'unknown',
  threads TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  status_hidden INTEGER NOT NULL DEFAULT 0,
  tape_ids TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS quiz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  answer INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS guide (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  aside_title TEXT NOT NULL DEFAULT '',
  aside_body TEXT NOT NULL DEFAULT '',
  widget TEXT NOT NULL DEFAULT 'none',
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tape_id INTEGER NOT NULL REFERENCES tapes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'comment',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_tape ON comments(tape_id, status);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key, at);
`;

async function openFile(): Promise<Db> {
  const { default: Database } = await import("better-sqlite3");
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "mandela.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  return {
    all: async <T,>(q: string, ...a: Arg[]) => d.prepare(q).all(...a) as T[],
    get: async <T,>(q: string, ...a: Arg[]) => d.prepare(q).get(...a) as T | undefined,
    run: async (q: string, ...a: Arg[]) => {
      const r = d.prepare(q).run(...a);
      return { changes: r.changes, lastId: Number(r.lastInsertRowid) };
    },
    batch: async (stmts: Stmt[]) => {
      d.transaction(() => {
        for (const s of stmts) d.prepare(s.sql).run(...(s.args ?? []));
      })();
    },
  };
}

/** Wraps any libSQL client (Turso over HTTP in production; a local file client in the test suite) as a Db. */
export function fromLibsql(c: Client): Db {
  const plain = (rs: { columns: string[]; rows: ArrayLike<unknown>[] }) =>
    rs.rows.map((r) => Object.fromEntries(rs.columns.map((col, i) => [col, r[i]]))) as Row[];
  return {
    all: async <T,>(q: string, ...a: Arg[]) => plain(await c.execute({ sql: q, args: a })) as T[],
    get: async <T,>(q: string, ...a: Arg[]) => plain(await c.execute({ sql: q, args: a }))[0] as T | undefined,
    run: async (q: string, ...a: Arg[]) => {
      const r = await c.execute({ sql: q, args: a });
      return { changes: r.rowsAffected, lastId: Number(r.lastInsertRowid ?? 0) };
    },
    batch: async (stmts: Stmt[]) => {
      await c.batch(stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "write");
    },
  };
}

async function openTurso(url: string, authToken: string | undefined): Promise<Db> {
  // The web build speaks HTTP only, so it has no native code and runs on serverless platforms.
  const { createClient } = await import("@libsql/client/web");
  return fromLibsql(createClient({ url, authToken }));
}

let opener: (() => Promise<Db>) | null = null;
/** For tests: open a different driver (for example the libSQL file client) instead of the configured one. */
export function useDriverForTests(open: (() => Promise<Db>) | null) {
  opener = open;
  (globalThis as unknown as { __mcdb?: Promise<Db> }).__mcdb = undefined;
}

async function open(): Promise<Db> {
  if (opener) return opener();
  const url = process.env.TURSO_DATABASE_URL?.trim();
  return url ? openTurso(url, process.env.TURSO_AUTH_TOKEN?.trim() || undefined) : openFile();
}

const g = globalThis as unknown as { __mcdb?: Promise<Db> };

/** The ready database (schema, migrations, seed and admin done once per process). */
export function getDb(): Promise<Db> {
  if (!g.__mcdb) {
    g.__mcdb = init().catch((e) => {
      g.__mcdb = undefined; // let the next request try again
      throw e;
    });
  }
  return g.__mcdb;
}

async function init(): Promise<Db> {
  const d = await open();
  await d.batch(SCHEMA.split(";").map((s) => s.trim()).filter(Boolean).map((sql) => ({ sql })));
  await migrate(d);
  await seedIfEmpty(d);
  await bootstrapAdmin(d);
  return d;
}

/** Shorthand used everywhere: `await sql.get<Row>("SELECT ... WHERE id = ?", id)`. */
export const sql = {
  all: async <T = Row,>(q: string, ...a: Arg[]) => (await getDb()).all<T>(q, ...a),
  get: async <T = Row,>(q: string, ...a: Arg[]) => (await getDb()).get<T>(q, ...a),
  run: async (q: string, ...a: Arg[]) => (await getDb()).run(q, ...a),
  batch: async (stmts: Stmt[]) => (await getDb()).batch(stmts),
};

/** There is no migration framework: each change to an existing table is a guarded ALTER here. */
async function migrate(d: Db) {
  const cols = await d.all<{ name: string }>("PRAGMA table_info(tapes)");
  if (!cols.some((c) => c.name === "youtube_url")) {
    await d.run("ALTER TABLE tapes ADD COLUMN youtube_url TEXT NOT NULL DEFAULT ''");
    await backfillYoutubeLinks(d);
  }
}

async function bootstrapAdmin(d: Db) {
  const name = process.env.ADMIN_USERNAME?.trim();
  const pass = process.env.ADMIN_PASSWORD;
  if (!name || !pass) return;
  if (await d.get("SELECT id FROM users WHERE username = ?", name)) return;
  try {
    await d.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", name, bcrypt.hashSync(pass, 12));
  } catch {
    /* two cold starts raced to create it; the other one won */
  }
}
