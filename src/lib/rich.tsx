import React from "react";

/**
 * A tiny, safe text format for admin-written content.
 * Blank line = new paragraph. Lines starting with "- " make a list.
 * Inline: **bold**, *italic*, [label](https://link). Everything else is escaped by React.
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

export function RichInline({ text }: { text: string }) {
  const parts = text.split(INLINE).filter((p) => p !== "");
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        const m = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(p);
        if (m)
          return (
            <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer">
              {m[1]}
            </a>
          );
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

export function Rich({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/).filter(Boolean);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n").map((l) => l.trimEnd());
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  <RichInline text={l.slice(2)} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <RichInline text={lines.join(" ")} />
          </p>
        );
      })}
    </>
  );
}
