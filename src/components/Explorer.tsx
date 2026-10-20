"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Tape } from "@/lib/content";
import { fmtDate } from "@/lib/format";
import { THREADS } from "@/lib/threads";
import { usePrefs } from "./PrefsProvider";
import { Stills } from "./Stills";
import { WatchLink } from "./WatchLink";

const pad = (n: number) => String(n).padStart(2, "0");

function Reel() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="#0a0b10" stroke="#555a6b" />
      <g stroke="#8d93a6" strokeWidth="2">
        <line x1="14" y1="4" x2="14" y2="24" />
        <line x1="5.3" y1="9" x2="22.7" y2="19" />
        <line x1="5.3" y1="19" x2="22.7" y2="9" />
      </g>
      <circle cx="14" cy="14" r="4" fill="#20222d" />
    </svg>
  );
}

export function Explorer({ tapes, title, lede }: { tapes: Tape[]; title: string; lede: string }) {
  const { prefs } = usePrefs();
  const mains = tapes.filter((t) => t.isMain);
  const [sel, setSel] = useState<number>(mains.length ? mains[mains.length - 1].id : tapes[0]?.id ?? 0);
  const [kind, setKind] = useState<"all" | "main" | "short">("all");
  const [thread, setThread] = useState("all");
  const [sort, setSort] = useState<"release" | "world">("release");

  // Other parts of the page (case files) can ask the explorer to load a tape.
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      setKind("all");
      setThread("all");
      setSel(id);
    };
    window.addEventListener("mc:select-tape", on);
    return () => window.removeEventListener("mc:select-tape", on);
  }, []);

  const matches = (t: Tape) => (kind === "main" ? t.isMain : kind === "short" ? !t.isMain : true) && (thread === "all" || t.threads.includes(thread));

  const shelf = useMemo(() => {
    const list = tapes.filter(matches);
    if (sort === "world") {
      list.sort((a, b) => {
        if (a.inworldSort === null && b.inworldSort === null) return a.number - b.number;
        if (a.inworldSort === null) return 1;
        if (b.inworldSort === null) return -1;
        return a.inworldSort - b.inworldSort;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapes, kind, thread, sort]);

  if (!tapes.length) return <p className="mute">No tapes yet.</p>;
  const idx = Math.max(0, tapes.findIndex((t) => t.id === sel));
  const cur = tapes[idx];
  const maxS = Math.max(...tapes.map((t) => t.seconds), 1);
  const step = 52, base = 160, hMax = 128;
  const years: { x: number; y: string }[] = [];
  tapes.forEach((t, i) => {
    const y = t.releaseDate.slice(0, 4);
    if (!years.length || years[years.length - 1].y !== y) years.push({ x: i * step + 5, y });
  });

  return (
    <>
      <div className="kicker">The tape counter</div>
      <h2>{title}</h2>
      <p className="lede">{lede}</p>

      <div className="chartbox">
        <div className="hd">
          <span className="legend">
            <span><i style={{ background: "var(--red)" }} />Main volume</span>
            <span><i style={{ background: "var(--blue-soft)" }} />Shorter installment</span>
          </span>
          <span className="mute" style={{ fontSize: ".82rem" }}>Spaced by release order, not by date.</span>
        </div>
        <div className="scroll-x">
          <svg viewBox={`0 0 ${tapes.length * step} 222`} style={{ minWidth: Math.max(760, tapes.length * 40) }} role="group" aria-label="Runtime of each tape in release order">
            <line x1="0" y1={base} x2={tapes.length * step} y2={base} stroke="var(--line)" />
            {tapes.map((t, i) => {
              const x = i * step + 11, h = Math.max(3, (t.seconds / maxS) * hMax), y = base - h;
              const on = t.id === cur.id;
              return (
                <g
                  key={t.id}
                  className={`bar${on ? " sel" : ""}${matches(t) ? "" : " dim"}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Tape ${t.number}, ${t.title}, ${t.runtime}`}
                  onClick={() => setSel(t.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(t.id))}
                >
                  <title>{`${t.title} · ${t.runtime}`}</title>
                  <rect x={x - 6} y={0} width={42} height={base + 28} fill="transparent" />
                  <rect x={x} y={y} width={30} height={h} fill={on ? "var(--amber)" : t.isMain ? "var(--red)" : "var(--blue-soft)"} />
                  {on && <text x={x + 15} y={y - 6} textAnchor="middle">{t.runtime}</text>}
                  <text x={x + 15} y={base + 18} textAnchor="middle">{pad(t.number)}</text>
                </g>
              );
            })}
            {years.map((yr) => (
              <g key={yr.y}>
                <line x1={yr.x} y1={base + 24} x2={yr.x} y2={base + 34} stroke="var(--mute)" />
                <text x={yr.x + 4} y={base + 50} fill="var(--mute)" style={{ font: "400 17px VT323, monospace" }}>{yr.y}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <article className="now" id="now" aria-live="polite">
        <div className="row1">
          <span>▶ PLAY SP</span>
          <span>TAPE {pad(cur.number)} / {tapes.length}</span>
          <div className="nav2">
            <button type="button" className="btn" disabled={idx === 0} onClick={() => setSel(tapes[idx - 1].id)}>◀◀ Prev</button>
            <button type="button" className="btn" disabled={idx === tapes.length - 1} onClick={() => setSel(tapes[idx + 1].id)}>Next ▶▶</button>
          </div>
        </div>
        <h3>{cur.title}</h3>
        <div className="facts">
          <div className="fact"><b>Released</b>{fmtDate(cur.releaseDate)}</div>
          <div className="fact"><b>Runtime</b>{cur.runtime}</div>
          <div className="fact"><b>Type</b>{cur.isMain ? "Main volume" : "Shorter installment"}</div>
          <div className="fact">
            <b>In the story</b>
            {cur.inworldLabel || "Undated"}
            <span className={`badge${cur.confidence === "stated" ? " s" : ""}`}>{cur.confidence}</span>
          </div>
        </div>
        <div className="runbar" title={`Runtime compared with the longest tape (${maxS} seconds)`}><i style={{ width: `${((cur.seconds / maxS) * 100).toFixed(1)}%` }} /></div>
        <p className="sum spoil" key={cur.id}>{cur.summary}</p>
        {cur.note && <p className="note">{cur.note}</p>}
        <p className="acts">
          {cur.youtubeUrl && <WatchLink className="btn sm watch" href={cur.youtubeUrl} title={cur.title}>Watch the original</WatchLink>}
          <Link className="btn sm" href={`/tapes/${cur.id}`}>Open this tape&apos;s page: notes, theories, comments</Link>
        </p>
        <Stills key={cur.id} tapeId={cur.id} label={`TAPE ${pad(cur.number)}`} />
      </article>

      <div className="filters">
        <div className="chips">
          <span className="lab">Show</span>
          {([["all", `All ${tapes.length}`], ["main", "Main volumes"], ["short", "Shorts"]] as const).map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={kind === v} onClick={() => setKind(v)}>{l}</button>
          ))}
        </div>
        <div className="chips">
          <span className="lab">Thread</span>
          {[["all", "All"] as [string, string], ...THREADS].map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={thread === v} onClick={() => setThread(v)}>{l}</button>
          ))}
        </div>
        <div className="chips">
          <span className="lab">Order</span>
          <button type="button" className="chip" aria-pressed={sort === "release"} onClick={() => setSort("release")}>Release</button>
          <button type="button" className="chip" aria-pressed={sort === "world"} onClick={() => setSort("world")}>In-story</button>
        </div>
      </div>

      <div className={`shelf${prefs.shelf === "list" ? " list" : ""}`}>
        {shelf.length === 0 && <p className="mute">No tapes match that combination. Try another thread.</p>}
        {shelf.map((t) => (
          <div key={t.id} className="tapewrap">
            <button type="button" className={`tape${t.isMain ? " main" : ""}`} aria-pressed={t.id === cur.id} onClick={() => { setSel(t.id); document.getElementById("now")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <div className="lbl">
                <div className="no"><span>TAPE {pad(t.number)}</span><span>{t.isMain ? "VOL" : "SHORT"}</span></div>
                <div className="ttl">{t.title}</div>
                <div className="meta">{sort === "world" ? t.inworldLabel || "Undated" : t.releaseDate.slice(0, 4)} · {t.runtime}</div>
              </div>
              <div className="reels"><Reel /><span className="win" /><Reel /></div>
            </button>
            {t.youtubeUrl && <WatchLink className="yt" href={t.youtubeUrl} title={t.title} />}
          </div>
        ))}
      </div>
    </>
  );
}
