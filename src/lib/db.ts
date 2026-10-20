import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { seedIfEmpty } from "./seed";

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
`;

const g = globalThis as unknown as { __mcdb?: Database.Database };

export function db(): Database.Database {
  if (g.__mcdb) return g.__mcdb;
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "mandela.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  d.exec(SCHEMA);
  seedIfEmpty(d);
  bootstrapAdmin(d);
  g.__mcdb = d;
  return d;
}

function bootstrapAdmin(d: Database.Database) {
  const name = process.env.ADMIN_USERNAME?.trim();
  const pass = process.env.ADMIN_PASSWORD;
  if (!name || !pass) return;
  const row = d.prepare("SELECT id FROM users WHERE username = ?").get(name);
  if (row) return;
  d.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
    name,
    bcrypt.hashSync(pass, 12),
  );
}
