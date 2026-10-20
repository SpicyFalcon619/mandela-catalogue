# CLAUDE.md

Next.js 16 (App Router, TypeScript) fan site for *The Mandela Catalogue*. SQLite via better-sqlite3. No ORM.

## Commands
- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck` (run after every change)
- `npm test` (Vitest, runs in about 2s; run after touching actions, auth or db). `npm run test:libsql` runs the same suite through the libSQL client, the code path Turso uses in production.
- `npm run e2e` (builds, then Playwright in headless Chromium, about 1 minute; run before shipping UI or flow changes. First time: `npx playwright install chromium`)
- `npm run db:reset` wipes content and reloads the seed (keeps users)

## Where things are
- `src/lib/db.ts`: async database layer with two drivers: a local SQLite file via better-sqlite3 (dev, tests, Docker) or Turso over HTTP via `@libsql/client/web` when `TURSO_DATABASE_URL` is set (Vercel). Also the schema (`CREATE TABLE IF NOT EXISTS`, split on `;`, so no semicolons inside a statement), `migrate()`, auto-seed on an empty database, and admin bootstrap from env. Query with `await sql.get/all/run(...)` and `sql.batch([...])` (one transaction, one round trip).
- `src/lib/seed.ts` + `seed-data.json` + `defaults.ts`: original content and every site setting with its default. A new setting key goes in `DEFAULT_SETTINGS` and `SETTING_FIELDS` (it shows up in Admin > Site settings by itself).
- `src/lib/entities.ts`: describes each admin-editable table (fields, types, columns). Adding a field = add a column in `db.ts` schema (plus a migration for existing databases) and a field here. The generic admin list and form pages read this file.
- `src/lib/content.ts`: read queries used by the public pages.
- Discussion system (tape pages): `src/lib/comment-types.ts` (browser-safe: the comment shape, Wilson "best" ranking, threading, search matching, time formatting), `src/lib/comments.ts` (database reads and the removal/purge helpers), `src/app/actions/comments.ts` (post, edit, delete, vote, report, mark replies read; each re-checks the caller and returns the updated comment so the page updates without a reload), `src/components/CommentSection.tsx` (the whole thread UI as one client component). Admin-only pieces (pin, resolve reports) live in `actions/admin.ts` and the moderation page.
- `src/lib/search.ts` + `src/app/search/page.tsx`: site search over tapes, case files, guide, cards, sources and visible comments (LIKE with escaped wildcards; skips sections an admin switched off; spoiler-flagged comments are not quoted).
- `src/lib/auth.ts`: bcrypt + jose JWT cookie sessions, `getUser`, `requireUser`, `requireAdmin`.
- `src/lib/prefs.ts` (client-safe) and `prefs-server.ts`: visitor display preferences (cookie, then account, then site default). Applied as data attributes on `<html>`: `data-theme`, `data-fx`, `data-font`, `data-size`, `data-spoilers`. Theme tokens live in `src/app/globals.css`.
- `src/app/actions/*.ts`: server actions. Files marked "use server" may only export async functions (no constants or sync helpers).
- `src/components/`: client components. Never import from `@/lib/content` values or `@/lib/db` in a client component (types only with `import type`).

## Rules
- All database access is async and goes through `sql` (or `getDb()`). Use plain SQLite SQL that both drivers accept, use `sql.batch` for anything that must be atomic, and delete child rows (comments) explicitly instead of relying on foreign-key cascades. Content getters in `content.ts` are async too; `getSettings` and `getTapes` are memoized per request with React `cache`.
- Rate limits live in the database (`src/lib/rate.ts`, table `rate_limits`), not in memory: serverless hosting runs many short-lived instances. `tooMany` is async and records the attempt before counting.
- Comment rules worth keeping: replies nest to `MAX_DEPTH` and deeper ones attach one level up; a comment with replies that is deleted stays as an empty "[deleted]" placeholder (`removeComment`), otherwise it is removed with its votes and reports; no voting on or reporting your own comment; `REPORT_HIDE_THRESHOLD` (3) different reporters hide a comment until an admin restores or deletes it (never auto-hides an admin's); editing an approved theory or correction sends it back to review; replies are always plain comments and need a visible parent. Votes are counted from `comment_votes` on every read, never stored as a total. Deleting a user goes through `purgeUser` (placeholders are handed to the acting admin so replies are not orphaned by a cascade; Turso enforces foreign keys just like the local driver).
- Admin pages AND admin actions must each call `requireAdmin()`. Layout checks alone are not enough in Next.
- No schema migrations framework yet: when changing a table, add an `ALTER TABLE ... ADD COLUMN` guarded by a column check in `db()` so existing databases keep working. `migrate()` in `src/lib/db.ts` is where these go (`youtube_url` was the first). `tests/migration.test.ts` shows how to test one against an old-schema file.
- Do NOT add screenshots, frames, character art or redrawn characters from the series (owner: Alex Kister). Link to the originals.
- Each tape has an optional `youtube_url` (link only: no embeds, no thumbnails, which would be frames). The 19 seeded links come from the official playlist that Wikipedia links, checked one by one against YouTube's oEmbed on 2026-10-20 (17 on Alex Kister's channel, 2 on the affiliated GENESIS APOCRYPHON channel). Anything rendered as a watch link must pass `youtubeHref()` in `src/lib/youtube.ts` (https, youtube.com or youtu.be only).
- Facts must trace to a listed source. Mark unconfirmed items ("inferred", "unconfirmed"). Do not define M.A.D. or the T.H.I.N.K. Principle beyond the sources.
- Keep the content note and the credit line to Alex Kister in the footer (they are site settings).
- User text is plain text only. Admin text goes through `src/lib/rich.tsx` (bold, italic, http(s) links, lists).
- Page scroll anchoring is off (`html { overflow-anchor: none }`): the tape filters resize the page below them, and with anchoring on the browser scrolled the page when they were pressed. `e2e/smoke.spec.ts` guards this.
- Theme tokens in `globals.css` must hold real values. A token defined as itself (`--cell: var(--cell)`) is invalid CSS and silently renders nothing; this had left the default theme without cassette bodies, panel backgrounds and quiz highlight colors.
- Next 16: `params` and `searchParams` are Promises; `cookies()` and `headers()` are async.
- Sandbox note: Google Fonts cannot be fetched in the dev sandbox, so fonts fall back to monospace there. They load normally for real visitors.

## Automated tests (`tests/`)
Server actions are called directly against a throwaway SQLite file. `tests/setup.ts` fakes `next/headers`, `next/navigation` and `next/cache`; `redirect()` throws, and `redirectOf()` in `tests/helpers.ts` reads the target. `admin-authz.test.ts` checks that every export of `actions/admin.ts` rejects anonymous and non-admin callers; it also fails when a new admin action is added without being listed, so add new ones to its `cases()`. The rate limiter is process-wide, so tests that hit it use a distinct `x-forwarded-for` or user.

## Browser tests (`e2e/`)
Specs: `smoke.spec.ts` (site basics, accounts, admin) and `discussion.spec.ts` (threads, votes, sort, search, edit/delete, reports, pins, spoilers, reply notifications, site search). Each simulated visitor in `discussion.spec.ts` sends its own `x-forwarded-for` so the 5-sign-ups-per-hour limit does not apply across them. Find a comment by its stable `#c<id>` when its text can change (editing turns the text into a text box). `e2e/serve.mjs` starts `.next/standalone/server.js` (what the Dockerfile runs) on port 3100 with a fresh `data/e2e.db` and the admin `e2eadmin`. Tests share that server and database, so keep usernames unique (`name()` helper) and mind the rate limits: 5 sign-ups per hour per IP (the suite uses 4), 6 logins per 15 minutes per account (the admin signs in once and the session is reused). Use `input[name=...]` selectors for form fields: label text includes the hint text, and `getByRole("alert")` also matches Next's route announcer.

## Flows covered by hand before the e2e suite existed (headless Chromium, production build)
Register, login (wrong password), comment, theory moderation, hero text edit, section hide, tape create/validate/delete, display prefs (cookie + account), all admin pages, 404, no horizontal scroll at 390px.
