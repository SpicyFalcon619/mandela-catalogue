"use client";

import { useState } from "react";
import type { GuideTab } from "@/lib/content";
import { Rich, RichInline } from "@/lib/rich";

function PopChart() {
  return (
    <>
      <div className="pop">
        <div><span>15,000</span><i className="b" style={{ height: "100%" }} /></div>
        <div><span>~1,000</span><i className="b" style={{ height: "6.7%" }} /></div>
      </div>
      <div className="pops"><span>1992</span><span>2009</span></div>
    </>
  );
}

export function GuideTabs({ tabs }: { tabs: GuideTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  if (!tabs.length) return null;
  const cur = tabs.find((t) => t.id === active) ?? tabs[0];
  const hasAside = !!(cur.asideTitle || cur.asideBody || cur.widget !== "none");
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} className="tab" aria-selected={t.id === cur.id} onClick={() => setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={`panel${hasAside ? "" : " solo"}`} role="tabpanel" aria-labelledby={`tab-${cur.id}`}>
        <div>
          <h3>{cur.label}</h3>
          <Rich text={cur.body} />
        </div>
        {hasAside && (
          <div className="aside">
            {cur.asideTitle && <h4>{cur.asideTitle}</h4>}
            {cur.widget === "population" && <PopChart />}
            {cur.asideBody && (
              <p className={cur.widget === "population" ? "mute" : undefined} style={{ fontSize: ".9rem", margin: "10px 0 0" }}>
                <RichInline text={cur.asideBody} />
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
