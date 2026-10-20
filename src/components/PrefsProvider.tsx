"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { savePrefs } from "@/app/actions/prefs";
import type { Prefs } from "@/lib/prefs";

type Ctx = { prefs: Prefs; set: (patch: Partial<Prefs>) => void };
const PrefsCtx = createContext<Ctx | null>(null);

function apply(p: Prefs) {
  const r = document.documentElement;
  r.dataset.theme = p.theme;
  r.dataset.fx = p.fx;
  r.dataset.font = p.font;
  r.dataset.size = p.size;
  r.dataset.spoilers = p.spoilers ? "on" : "off";
}

export function PrefsProvider({ initial, children }: { initial: Prefs; children: React.ReactNode }) {
  const [prefs, setPrefs] = useState(initial);
  const ref = useRef(initial);
  const [, start] = useTransition();

  const set = useCallback(
    (patch: Partial<Prefs>) => {
      const next = { ...ref.current, ...patch };
      ref.current = next;
      setPrefs(next);
      apply(next);
      start(() => {
        void savePrefs(next);
      });
    },
    [start],
  );

  // Click a blurred spoiler to reveal it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.(".spoil");
      if (t && document.documentElement.dataset.spoilers === "on") t.classList.add("rev");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <PrefsCtx.Provider value={{ prefs, set }}>{children}</PrefsCtx.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error("usePrefs must be used inside PrefsProvider");
  return c;
}
