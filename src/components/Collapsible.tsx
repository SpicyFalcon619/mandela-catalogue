"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A section that starts closed and opens on click. It is a native <details>, so it also works without JavaScript.
 * A link to its #id (for example from the home page player) opens it and scrolls to it.
 */
export function Collapsible({ id, kicker, title, hint, children }: { id: string; kicker: string; title: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      if (window.location.hash === `#${id}`) {
        setOpen(true);
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);

  return (
    <details className="collapse" id={id} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="collapse-text">
          <span className="kicker">{kicker}</span>
          <span className="collapse-title">{title}</span>
          {hint && <span className="collapse-hint">{hint}</span>}
        </span>
        <svg className="collapse-chev" viewBox="0 0 12 12" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
          <path d="M2 4.5l4 4 4-4" />
        </svg>
      </summary>
      <div className="collapse-body">{children}</div>
    </details>
  );
}
