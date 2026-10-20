import { getDb } from "../src/lib/db";
import { resetContent } from "../src/lib/seed";

// Usage: npm run db:reset
// Wipes tapes, characters, quiz, sources, guide, cards, settings and comments, then reloads the original data.
// User accounts are kept.
if (!process.argv.includes("--reset")) {
  console.log(
    "Nothing to do. The app fills an empty database by itself on first start.\nRun `npm run db:reset` to wipe content and reload the original data.",
  );
  process.exit(0);
}
// Works against whatever database the environment points at: ./data/mandela.db, DATABASE_PATH, or Turso
// when TURSO_DATABASE_URL is set.
await resetContent(await getDb());
console.log("Content reset.");
