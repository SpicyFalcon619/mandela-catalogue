# CLAUDE.md

Next.js 16 (App Router, TypeScript) fan site for *The Mandela Catalogue*. SQLite via better-sqlite3. No ORM.

## Commands
- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck` (run after every change)
- `npm test` (Vitest, runs in about 2s; run after touching actions, auth or db)
- `npm run e2e` (builds, then Playwright in headless Chromium, about 1 minute; run before shipping UI or flow changes. First time: `npx playwright install chromium`)
- `npm run db:reset` wipes content and reloads the seed (keeps users)

## Where things are
- `src/lib/db.ts`: connection, schema (`CREATE TABLE IF NOT EXISTS`), auto-seed on an empty database, admin bootstrap from env.
- `src/lib/seed.ts` + `seed-data.json` + `defaults.ts`: original content and every site setting with its default. A new setting key goes in `DEFAULT_SETTINGS` and `SETTING_FIELDS` (it shows up in Admin > Site settings by itself).
- `src/lib/entities.ts`: describes each admin-editable table (fields, types, columns). Adding a field = add a column in `db.ts` schema (plus a migration for existing databases) and a field here. The generic admin list and form pages read this file.
- `src/lib/content.ts`: read queries used by the public pages.
- `src/lib/auth.ts`: bcrypt + jose JWT cookie sessions, `getUser`, `requireUser`, `requireAdmin`.
- `src/lib/prefs.ts` (client-safe) and `prefs-server.ts`: visitor display preferences (cookie, then account, then site default). Applied as data attributes on `<html>`: `data-theme`, `data-fx`, `data-font`, `data-size`, `data-spoilers`. Theme tokens live in `src/app/globals.css`.
- `src/app/actions/*.ts`: server actions. Files marked "use server" may only export async functions (no constants or sync helpers).
- `src/components/`: client components. Never import from `@/lib/content` values or `@/lib/db` in a client component (types only with `import type`).

## Rules
- Admin pages AND admin actions must each call `requireAdmin()`. Layout checks alone are not enough in Next.
- No schema migrations framework yet: when changing a table, add an `ALTER TABLE ... ADD COLUMN` guarded by a column check in `db()` so existing databases keep working.
- Do NOT add screenshots, frames, character art or redrawn characters from the series (owner: Alex Kister). Link to the originals.
- Facts must trace to a listed source. Mark unconfirmed items ("inferred", "unconfirmed"). Do not define M.A.D. or the T.H.I.N.K. Principle beyond the sources.
- Keep the content note and the credit line to Alex Kister in the footer (they are site settings).
- User text is plain text only. Admin text goes through `src/lib/rich.tsx` (bold, italic, http(s) links, lists).
- Next 16: `params` and `searchParams` are Promises; `cookies()` and `headers()` are async.
- Sandbox note: Google Fonts cannot be fetched in the dev sandbox, so fonts fall back to monospace there. They load normally for real visitors.

## Automated tests (`tests/`)
Server actions are called directly against a throwaway SQLite file. `tests/setup.ts` fakes `next/headers`, `next/navigation` and `next/cache`; `redirect()` throws, and `redirectOf()` in `tests/helpers.ts` reads the target. `admin-authz.test.ts` checks that every export of `actions/admin.ts` rejects anonymous and non-admin callers; it also fails when a new admin action is added without being listed, so add new ones to its `cases()`. The rate limiter is process-wide, so tests that hit it use a distinct `x-forwarded-for` or user.

## Browser tests (`e2e/`)
`e2e/serve.mjs` starts `.next/standalone/server.js` (what the Dockerfile runs) on port 3100 with a fresh `data/e2e.db` and the admin `e2eadmin`. Tests share that server and database, so keep usernames unique (`name()` helper) and mind the rate limits: 5 sign-ups per hour per IP (the suite uses 4), 6 logins per 15 minutes per account (the admin signs in once and the session is reused). Use `input[name=...]` selectors for form fields: label text includes the hint text, and `getByRole("alert")` also matches Next's route announcer.

## Flows covered by hand before the e2e suite existed (headless Chromium, production build)
Register, login (wrong password), comment, theory moderation, hero text edit, section hide, tape create/validate/delete, display prefs (cookie + account), all admin pages, 404, no horizontal scroll at 390px.
