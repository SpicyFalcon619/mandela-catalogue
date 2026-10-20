"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Visitors' own screenshots for a tape. Stored in the visitor's browser (IndexedDB) and never uploaded. */
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const r = indexedDB.open("mc-stills", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("s");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
function readAll(db: IDBDatabase, id: number): Promise<Blob[]> {
  return new Promise((resolve) => {
    try {
      const q = db.transaction("s").objectStore("s").get(id);
      q.onsuccess = () => resolve((q.result as Blob[] | undefined) ?? []);
      q.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export function Stills({ tapeId, label }: { tapeId: number; label: string }) {
  const [files, setFiles] = useState<Blob[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const db = useRef<IDBDatabase | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    openDb().then(async (d) => {
      db.current = d;
      const all = d ? await readAll(d, tapeId) : [];
      if (alive) setFiles(all);
    });
    return () => {
      alive = false;
    };
  }, [tapeId]);

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);

  const save = useCallback(
    (next: Blob[]) => {
      setFiles(next);
      try {
        db.current?.transaction("s", "readwrite").objectStore("s").put(next, tapeId);
      } catch {
        /* storage may be unavailable; images stay for this visit */
      }
    },
    [tapeId],
  );

  const add = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (imgs.length) save([...files, ...imgs]);
  };

  return (
    <div
      className={`stills${over ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        add(e.dataTransfer.files);
      }}
    >
      <div className="sh">
        <span>YOUR STILLS · {label}</span>
        <span>
          <button type="button" className="btn" onClick={() => input.current?.click()}>
            Add image
          </button>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </span>
      </div>
      <div className="sgrid">
        {files.length === 0 && (
          <p className="mute" style={{ margin: 0, fontSize: ".85rem" }}>
            No stills yet. Drop your own screenshots here or use Add image. They stay in this browser only.
          </p>
        )}
        {urls.map((u, i) => (
          <figure key={u}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Your still ${i + 1} for ${label}`} />
            <button type="button" aria-label="Remove still" onClick={() => save(files.filter((_, j) => j !== i))}>
              ×
            </button>
          </figure>
        ))}
      </div>
    </div>
  );
}
