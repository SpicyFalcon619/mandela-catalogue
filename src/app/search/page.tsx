import Link from "next/link";
import { headers } from "next/headers";
import { Fragment } from "react";
import { clientKey } from "@/lib/client-ip";
import { getSettings } from "@/lib/content";
import { tooMany } from "@/lib/rate";
import { MAX_QUERY, MIN_QUERY, searchSite } from "@/lib/search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const SUGGESTIONS = ["Gabriel", "Intruder", "Adam Murray", "Alternates", "Presto", "2009"];

function Mark({ text, q }: { text: string; q: string }) {
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, MAX_QUERY);
  let groups: Awaited<ReturnType<typeof searchSite>> = [];
  let message = "";
  if (q.length >= MIN_QUERY) {
    if (await tooMany(`search:${clientKey(await headers())}`, 30, 60 * 1000)) message = "Too many searches in a minute. Wait a moment and try again.";
    else groups = await searchSite(q, await getSettings());
  } else if (q.length > 0) message = `Type at least ${MIN_QUERY} characters.`;
  const total = groups.reduce((a, g) => a + g.hits.length, 0);

  return (
    <main>
      <div className="crumbs"><Link href="/">← Home</Link></div>
      <h1 style={{ fontSize: "3.4rem", margin: "14px 0 6px" }}>Search</h1>
      <p className="mute">Tapes, case files, the field guide, notes and the discussion.</p>
      <form action="/search" method="get" role="search" className="search-box">
        <label>
          <span className="vh">Search the guide</span>
          <input type="search" name="q" defaultValue={q} maxLength={MAX_QUERY} placeholder="Search for a name, a tape, a word…" autoFocus />
        </label>
        <button type="submit" className="btn fill">Search</button>
      </form>
      {message && <p className="err" role="alert">{message}</p>}
      {q.length === 0 && (
        <p className="search-sugg">
          Try: {SUGGESTIONS.map((s) => <Link key={s} className="chip" href={`/search?q=${encodeURIComponent(s)}`}>{s}</Link>)}
        </p>
      )}
      {q.length >= MIN_QUERY && !message && (
        <p className="mute" role="status">{total === 0 ? `Nothing found for “${q}”.` : `${total} ${total === 1 ? "result" : "results"} for “${q}”.`}</p>
      )}
      {groups.map((g) => (
        <section key={g.id} className="search-group">
          <h2>{g.label} <span className="mute">{g.hits.length}</span></h2>
          <ul>
            {g.hits.map((h, i) => (
              <li key={`${h.href}-${i}`} className="hit">
                <Link href={h.href}>{h.title}</Link>
                <p className="snip spoil"><Mark text={h.snippet} q={q} /></p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
