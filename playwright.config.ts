import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  // Tests share one server and one database, and the app's rate limits are per process.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000, // generous: a busy machine can make the long multi-step tests slow
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Serves the existing standalone build (run `npm run build` first, or use `npm run e2e`).
    command: "node e2e/serve.mjs",
    url: `http://127.0.0.1:${PORT}/login`,
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
