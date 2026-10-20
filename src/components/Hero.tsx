"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { usePrefs } from "./PrefsProvider";

type Props = {
  kicker: string;
  title1: string;
  title2: string;
  sub: string;
  stats: { mains: number; shorts: number; footage: string; years: string };
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const p2 = (n: number) => String(n).padStart(2, "0");

export function Hero({ kicker, title1, title2, sub, stats }: Props) {
  const { prefs, set } = usePrefs();
  const cv = useRef<HTMLCanvasElement>(null);
  const [stamp, setStamp] = useState("");

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const h = n.getHours() % 12 || 12;
      setStamp(`${MONTHS[n.getMonth()]}. ${p2(n.getDate())} ${n.getFullYear()}  ${p2(h)}:${p2(n.getMinutes())}:${p2(n.getSeconds())} ${n.getHours() < 12 ? "AM" : "PM"}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = cv.current;
    if (!el || prefs.fx === "off") return;
    const cx = el.getContext("2d");
    if (!cx) return;
    const W = el.width, H = el.height;
    const img = cx.createImageData(W, H);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = reduce || prefs.fx === "low";
    let band = 0, last = 0, raf = 0, stop = false;
    const frame = (ts: number) => {
      if (stop) return;
      if (ts - last > 60 || still) {
        last = ts;
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }
        if (!still) {
          band = (band + 3) % (H + 40);
          for (let y = band - 12; y < band; y++) {
            if (y < 0 || y >= H) continue;
            for (let x = 0; x < W; x++) {
              const k = (y * W + x) * 4, g = (Math.random() * 60) | 0;
              d[k] = 20 + g; d[k + 1] = 20 + g; d[k + 2] = 140 + g;
            }
          }
        }
        cx.putImageData(img, 0, 0);
      }
      if (!still) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [prefs.fx]);

  return (
    <div className="hero">
      <canvas ref={cv} width={320} height={200} aria-hidden="true" />
      <div className="sweep" aria-hidden="true" />
      <div className="osdc tl" aria-hidden="true">PLAY ▶</div>
      <div className="osdc tr" aria-hidden="true">SP · CH 03</div>
      <div className="osdc bl" aria-hidden="true">{stamp}</div>
      <div className="osdc br" aria-hidden="true">TRACKING</div>
      <div className="kicker">
        <i className="rec" aria-hidden="true" />
        {kicker.split("·").map((part, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="sep" aria-hidden="true">/</span>}
            <span>{part.trim()}</span>
          </Fragment>
        ))}
      </div>
      <h1>
        {title1}
        <span>{title2}</span>
      </h1>
      <p className="sub"><span className="cap">{sub}</span></p>
      <dl className="stats" aria-label="The series at a glance">
        <div><dt>volumes</dt><dd>{stats.mains}</dd></div>
        <div><dt>shorts</dt><dd>{stats.shorts}</dd></div>
        <div><dt>footage</dt><dd>{stats.footage}</dd></div>
        <div><dt>released</dt><dd>{stats.years.replace(/(\d)-(\d)/, "$1–$2")}</dd></div>
      </dl>
      <div className="tools">
        <Link className="btn fill" href="/#tapes">Open the tapes</Link>
        <button type="button" className="btn" aria-pressed={prefs.spoilers} onClick={() => set({ spoilers: !prefs.spoilers })} title="Blur plot summaries until you click them">
          Spoiler guard: {prefs.spoilers ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
