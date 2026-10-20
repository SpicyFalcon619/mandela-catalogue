"use client";

import { useEffect, useState } from "react";

/** Appears after scrolling a screen or so; takes you back to the top of the page. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 900);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return (
    <button type="button" className="to-top" aria-label="Back to top" title="Back to top" onClick={() => window.scrollTo({ top: 0 })}>
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true" focusable="false">
        <path d="M4 12l6-6 6 6" />
      </svg>
    </button>
  );
}
