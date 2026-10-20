import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { vi } from "vitest";
import { fromLibsql, useDriverForTests } from "@/lib/db";

// Each test file gets its own throwaway database, created on first db() call and seeded with the original content.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0123456789";
delete process.env.ADMIN_USERNAME;
delete process.env.ADMIN_PASSWORD;

// `MC_DRIVER=libsql npm test` runs the whole suite through the libSQL client (the code path Turso uses in
// production) against a local file, instead of better-sqlite3. Same engine, same client code, no network.
if (process.env.MC_DRIVER === "libsql") {
  const file = process.env.DATABASE_PATH!;
  useDriverForTests(async () => fromLibsql(createClient({ url: `file:${file}` })));
}

// A fake request: cookies and headers the code under test reads through next/headers.
export const jar = new Map<string, string>();
export const reqHeaders = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => ({ get: (name: string) => reqHeaders.get(name.toLowerCase()) ?? null }),
}));

// redirect() throws in Next; tests catch it and read the target.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
