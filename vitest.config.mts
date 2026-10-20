import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // The real package throws outside the Next server bundle.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // better-sqlite3 is a native module; one process per file keeps each temp database separate.
    pool: "forks",
    // Sign-up tests hash several passwords at production strength (bcrypt cost 12), which can take over the
    // 5 s default on a slow machine, and a timed-out test would leak its session into the next one.
    testTimeout: 30_000,
  },
});
