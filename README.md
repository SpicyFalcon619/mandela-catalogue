# Mandela Catalogue Field Guide (app)

An interactive fan field guide to *The Mandela Catalogue*, the analog horror series by Alex Kister. Next.js app with a SQLite database.

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
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Creates this admin on start if it does not exist. |
| `COOKIE_SECURE` | Set to `false` only when serving over plain http. |

## Deploying

SQLite is a file, so the host needs a **persistent disk**. Good fits: any VPS, Fly.io, Railway, Render (with a disk), or Docker anywhere.

```bash
docker compose up -d --build     # needs AUTH_SECRET and ADMIN_PASSWORD in a .env file next to docker-compose.yml
```

Put it behind HTTPS (Caddy, nginx, or your host's built-in TLS). Back up by copying the database file (`/data/mandela.db` in Docker; stop the app or use `sqlite3 mandela.db ".backup backup.db"` for a consistent copy).

Vercel and Netlify functions have no persistent disk, so this version will not keep data there. To use them, swap the data layer in `src/lib/db.ts` and `src/lib/content.ts` for a hosted database such as Postgres or Turso. All SQL lives in those files, the `src/app/actions/` folder and the admin and tape pages.

The Docker image itself has not been built, because Docker was not available where this was developed. Everything the Dockerfile runs was checked on Linux (glibc, x86_64) with Node 22, the version the image uses: `npm ci`, `npm run build`, typecheck, the unit tests, then the `output: "standalone"` server (`node server.js`) with `NODE_ENV=production`. It created and seeded the database at `DATABASE_PATH`, created the admin from the environment, served pages, and passed the same request the `HEALTHCHECK` makes. `better-sqlite3` 13 ships prebuilt binaries for Linux (glibc and musl, x64 and arm64) inside its npm package, so the image needs no compiler and no download during `npm ci`. Run `docker compose up --build` once and confirm the container reports healthy before relying on it.
A bind-mounted data folder is owned by root and the app runs as `node`; use the named volume from `docker-compose.yml`, or `chown 1000:1000` the folder.

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
