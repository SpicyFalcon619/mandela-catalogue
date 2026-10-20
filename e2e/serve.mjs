// Starts the standalone production server (the same entry the Dockerfile runs) on a fresh
// throwaway database, with a known admin account.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const db = path.join(root, "data", "e2e.db");
for (const f of [db, `${db}-wal`, `${db}-shm`]) fs.rmSync(f, { force: true });

const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build found. Run `npm run build` first (or use `npm run e2e`).");
  process.exit(1);
}
// A standalone build does not include its static files; the Dockerfile copies them the same way.
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3100",
    HOSTNAME: "127.0.0.1",
    DATABASE_PATH: db,
    AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
    ADMIN_USERNAME: "e2eadmin",
    ADMIN_PASSWORD: "e2e-admin-password",
    COOKIE_SECURE: "false",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill());
