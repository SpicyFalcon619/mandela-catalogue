"use client";

import type { Character, Tape } from "@/lib/content";

const pad = (n: number) => String(n).padStart(2, "0");

export function Cases({ characters, tapes }: { characters: Character[]; tapes: Tape[] }) {
  const byId = new Map(tapes.map((t) => [t.id, t]));
  const jump = (id: number) => {
    window.dispatchEvent(new CustomEvent("mc:select-tape", { detail: id }));
    document.getElementById("now")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="cases">
      {characters.map((c, i) => (
        <div className="case" key={c.id}>
          <div className="fno">
            <span>FILE {pad(i + 1)}</span>
            <span>{c.statusHidden ? <>Status: <span className="redact" tabIndex={0}>{c.status}</span></> : c.status}</span>
          </div>
          <h3>{c.name}</h3>
          <div className="actor">{c.actor}</div>
          <p>{c.bio}</p>
          <div className="app">
            <span>SEEN IN</span>
            {c.tapeIds.map((id) => byId.get(id)).filter((t): t is Tape => !!t).map((t) => (
              <button key={t.id} type="button" title={t.title} onClick={() => jump(t.id)}>
                {pad(t.number)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
