import type { ReactNode } from "react";

/** Line-drawn play mark (no emoji, no brand artwork): a rounded screen with a triangle. */
export function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="1.5" y="3.5" width="17" height="13" rx="2.5" />
      <path d="M8.2 7.2v5.6l4.8-2.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * External link to the original video. Always opens a new tab and never passes the referrer or opener.
 * Icon-only links get a descriptive aria-label; links with visible text keep that text as their name
 * (so the accessible name contains the visible label) and add a visually hidden note.
 */
export function WatchLink({ href, title, className, children }: { href: string; title: string; className?: string; children?: ReactNode }) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={children ? undefined : `Watch ${title} on YouTube (opens in a new tab)`}
      title={`Watch “${title}” on YouTube`}
    >
      <PlayIcon />
      {children}
      {children && <span className="vh"> (opens YouTube in a new tab)</span>}
    </a>
  );
}
