# Mandela Catalogue Field Guide (app)

An interactive fan field guide to *The Mandela Catalogue*, the analog horror series by Alex Kister. Next.js app with a SQLite database.

**Live site:** https://mandela-catalogue.vercel.app

## What you can do with it

**Visitors**
- Explore every tape: runtime chart, cassette shelf, filters by type and thread, in-story ordering, spoiler guard.
- Open a page per tape and read the summary, the cast, and community posts.
- Pick a look from the **Display** button: 5 themes (tape, phosphor green, amber, monochrome, paper), 3 effect levels, 3 typefaces, 3 text sizes, grid or list shelf, spoiler blur. Saved in a cookie, and on the account if signed in (so it follows them to other devices).
- Sign up and post comments, fan theories and corrections.
- Add their own screenshots to each tape. These stay in their own browser (IndexedDB) and are never uploaded.

**Admins** (`/admin`)
- Add, edit and delete tapes, case files, quiz questions, sources, field-guide tabs and text cards.
- Edit site wording, accent colors, the default theme, the film date and the footer, and show or hide whole sections (Site settings).
- Moderate: theories and corrections wait for approval; comments can be hidden or deleted.
- Manage users: make admins, suspend, delete.
- Turn comments, submissions or sign-ups on and off.

## Run it locally

Needs Node 22 or newer.

```bash
npm install
cp .env.example .env.local      # then edit the values
npm run dev                     # http://localhost:3000
```

The database file is created and filled with the original content on first start. If `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set, that admin account is created automatically. Sign in at `/login`, then open `/admin`.

Other commands:

```bash
npm run build && npm start       # production mode
npm run typecheck
npm test                         # access rules, sign-in, comments and moderation
npm run e2e                      # builds, then browser tests (first: npx playwright install chromium)
npm run db:reset                 # wipes content, settings and comments, reloads the original data (accounts are kept)
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs login cookies. Required in production. `openssl rand -base64 48` |
| `DATABASE_PATH` | SQLite file. Default `./data/mandela.db`. Use a persistent disk in production. |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Use a hosted Turso database instead of the local file. Required on Vercel, which has no disk. Leave unset for local development. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Creates this admin on start if it does not exist. |
| `COOKIE_SECURE` | Set to `false` only when serving over plain http. |

## Deploying

The live site is at **https://mandela-catalogue.vercel.app**: Vercel (free Hobby plan, which is for non-commercial use) runs the app and Turso (free plan: 5 GB, 500 million row reads and 10 million row writes a month) holds the data. Neither needs a card.

Why two services: Vercel has no persistent disk, so the SQLite file that the app uses locally cannot live there. With `TURSO_DATABASE_URL` set, the app talks to Turso over HTTPS instead (`src/lib/db.ts` has both drivers behind one async interface).

### Set it up from scratch

1. **Turso:** sign in at turso.tech, create a database (choose AWS US East, the same region Vercel runs functions in), copy its `libsql://` URL and create a token.
2. **Vercel:** `npx vercel login`, then in the repo `npx vercel link --yes --project <name>`.
3. **Variables** (production), each with `npx vercel env add NAME production` (add `--sensitive` for secrets):

| Name | Value |
| --- | --- |
| `AUTH_SECRET` | a long random string (`openssl rand -base64 48`) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | the first admin account, created on first start |
| `TURSO_DATABASE_URL` | the `libsql://...` URL |
| `TURSO_AUTH_TOKEN` | the token (sensitive) |

4. **Deploy:** `npx vercel deploy --prod`. The first start creates the tables, loads the original content and creates the admin. To do that ahead of time, or to reset content later, run `npm run db:reset` with the same `TURSO_*` variables in your shell.

Later changes: push to GitHub, then `npx vercel deploy --prod` (or connect the repo in the Vercel dashboard for automatic deploys).

Things that differ from running on one server:
- Sign-in and posting rate limits are stored in the database (`rate_limits` table), because Vercel runs many short-lived instances; an in-memory counter would reset on each one.
- The visitor address for rate limiting comes from `X-Vercel-Forwarded-For`, which Vercel sets itself.
- Backups: Turso keeps point-in-time restore for 1 day on the free plan. For your own copy, use the Turso CLI (`turso db shell <name> .dump`).
- Rotate the Turso token if it is ever shown anywhere: create a new one, replace `TURSO_AUTH_TOKEN` in Vercel, redeploy, then revoke the old one.

### Anywhere with Docker, or a server with a disk

The same app runs from a SQLite file with no Turso variables. The image is built and health-checked in CI on every push.

```bash
docker compose up -d --build     # needs AUTH_SECRET and ADMIN_PASSWORD in a .env file next to docker-compose.yml
```

Put it behind HTTPS (Caddy, nginx, or your host's built-in TLS), and make sure the proxy appends the visitor's address to `X-Forwarded-For`: the app trusts the last entry there for rate limiting, so it must not be reachable except through your proxy. Back up by copying the database file (`/data/mandela.db`; stop the app or use `sqlite3 mandela.db ".backup backup.db"` for a consistent copy).

`fly.toml` is kept for Fly.io, but Fly no longer has a free tier (new accounts get a 5-minute trial), so it needs a paid account. Keep exactly one machine there: the volume belongs to one machine.

### What CI checks

`.github/workflows/ci.yml` runs typecheck, the unit tests on both database drivers (the local file and the libSQL client that Turso uses), and the browser tests. It also builds the Docker image, starts it, waits for the `HEALTHCHECK`, probes a few pages, checks the server runs as the unprivileged `node` user (the entrypoint starts as root only to fix ownership of a mounted `/data`, then drops privileges), proves that works with a root-owned volume, and restarts it. The image installs with `npm ci --ignore-scripts`: without that flag npm runs `node-gyp` for `better-sqlite3`, which needs Python and a compiler that `node:22-slim` does not have. The package ships prebuilt Linux binaries and loads them at runtime.

## Project layout

```
src/app/                 pages and server actions
  page.tsx               home (hero, tape explorer, guide, case files, quiz, sources)
  tapes/[id]/            per-tape page with comments and theories
  login, register, account
  admin/                 admin area (guarded by role)
  actions/               server actions: auth, comments, prefs, admin
src/components/          client components (Explorer, Hero, SettingsPanel, Quiz, ...)
src/lib/                 db, content queries, auth, prefs, seed, entity definitions
scripts/seed.ts          content reset script
```

## Security notes

- Passwords are hashed with bcrypt. Sessions are signed, httpOnly cookies. Bans and role changes apply on the next request.
- Every admin page and every admin action checks the admin role on the server.
- Login, sign-up and posting are rate limited in memory. That is fine for one server process; use a shared store (for example Redis) if you run several.
- User text is rendered as plain text. Admin-written content supports only bold, italic, links (http/https) and lists.
- There is no email, so there is no password reset by email. An admin can delete an account, or you can change a hash directly in the database.

## Content and credits

*The Mandela Catalogue*, its footage, characters and designs belong to Alex Kister. This project contains none of that artwork and links to the originals. Do not add frames or character art to the seed data or the admin; use links to the source pages (Fandom, IMDb, TV Tropes, TheTVDB, Wikipedia) instead. Unofficial fan project, not affiliated with the series or its creator.

Episode data comes from the Wikipedia article. Story dates marked "inferred" are interpretations. The film details come only from Wikipedia and are not confirmed in a news outlet.

The code is released under the [MIT License](LICENSE). That covers the code only. It does not cover *The Mandela Catalogue* itself (footage, characters, designs, names), which belongs to Alex Kister and is not licensed by this project.

## Contributing

Issues and pull requests are welcome. Before you open one:

- Run `npm run typecheck`, `npm test` and `npm run test:libsql`; for anything visible, also `npm run e2e` (see CLAUDE.md for how the tests work). CI runs all of them.
- Do not add screenshots, frames, character art or anything else from the series. Link to the originals instead.
- Facts in the guide must trace to a listed source, and anything unconfirmed must say so ("inferred", "unconfirmed").
- By contributing you agree your code is released under the MIT License above.

Found a mistake in a summary, date or credit? Please open an issue with the source that shows the correct version.
