import React from "react";

/**
 * A tiny, safe text format for admin-written content.
 * Blank line = new paragraph. Lines starting with "- " make a list, "1. " a numbered list, "## " a heading.
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
        const all = b.split("\n").map((l) => l.trimEnd());
        // A heading line may sit directly above the text it introduces.
        const head = all[0].startsWith("## ") ? all[0].slice(3).trim() : null;
        const lines = head === null ? all : all.slice(1);
        let body: React.ReactNode = null;
        if (lines.length && lines.every((l) => /^\d+\. /.test(l))) {
          body = (
            <ol>
              {lines.map((l, j) => (
                <li key={j}>
                  <RichInline text={l.replace(/^\d+\. /, "")} />
                </li>
              ))}
            </ol>
          );
        } else if (lines.length && lines.every((l) => l.startsWith("- "))) {
          body = (
            <ul>
              {lines.map((l, j) => (
                <li key={j}>
                  <RichInline text={l.slice(2)} />
                </li>
              ))}
            </ul>
          );
        } else if (lines.length) {
          body = (
            <p>
              <RichInline text={lines.join(" ")} />
            </p>
          );
        }
        return (
          <React.Fragment key={i}>
            {head !== null && <h3 className="rh">{head}</h3>}
            {body}
          </React.Fragment>
        );
      })}
    </>
  );
}
