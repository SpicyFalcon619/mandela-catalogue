"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_SETTINGS, SETTING_FIELDS } from "@/lib/defaults";
import { entityByKey, type Field } from "@/lib/entities";
import { resetContent } from "@/lib/seed";

function readField(f: Field, fd: FormData): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (f.type) {
    case "bool":
      return { ok: true, value: fd.get(f.name) === "on" ? 1 : 0 };
    case "number": {
      const raw = String(fd.get(f.name) ?? "").trim();
      if (raw === "") return f.nullable ? { ok: true, value: null } : f.required ? { ok: false, error: `${f.label} is required.` } : { ok: true, value: 0 };
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `${f.label} must be a number.` };
      return { ok: true, value: n + (f.offset ?? 0) };
    }
    case "tags":
      return { ok: true, value: JSON.stringify(fd.getAll(f.name).map(String).filter((v) => (f.options ?? []).some((o) => o[0] === v))) };
    case "tapes":
      return { ok: true, value: JSON.stringify(fd.getAll(f.name).map(Number).filter((n) => Number.isInteger(n))) };
    case "lines": {
      const lines = String(fd.get(f.name) ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (f.required && lines.length < 2) return { ok: false, error: `${f.label}: give at least two lines.` };
      return { ok: true, value: JSON.stringify(lines) };
    }
    case "select": {
      const v = String(fd.get(f.name) ?? "");
      if (!(f.options ?? []).some((o) => o[0] === v)) return { ok: false, error: `${f.label}: pick one of the options.` };
      return { ok: true, value: v };
    }
    default: {
      const v = String(fd.get(f.name) ?? "").trim();
      if (f.required && !v) return { ok: false, error: `${f.label} is required.` };
      return { ok: true, value: v };
    }
  }
}

function fail(entity: string, id: string, msg: string): never {
  redirect(`/admin/${entity}/${id}?error=${encodeURIComponent(msg)}`);
}

export async function saveEntity(entityKey: string, fd: FormData) {
  await requireAdmin();
  const entity = entityByKey(entityKey);
  if (!entity) redirect("/admin");
  const idRaw = String(fd.get("id") ?? "new");
  const values: Record<string, unknown> = {};
  for (const f of entity.fields) {
    const r = readField(f, fd);
    if (!r.ok) fail(entityKey, idRaw, r.error);
    values[f.name] = r.value;
  }
  // Extra checks per entity.
  if (entityKey === "tapes") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(values.release_date))) fail(entityKey, idRaw, "Release date must look like 2026-03-13.");
    if (!/^\d{1,3}:\d{2}$/.test(String(values.runtime))) fail(entityKey, idRaw, "Runtime must look like 26:33.");
  }
  if (entityKey === "sources" && !/^https?:\/\//i.test(String(values.url))) fail(entityKey, idRaw, "URL must start with http:// or https://");
  if (entityKey === "quiz") {
    const opts = JSON.parse(String(values.options)) as string[];
    const a = Number(values.answer);
    if (!Number.isInteger(a) || a < 0 || a >= opts.length) fail(entityKey, idRaw, `The correct option number must be between 1 and ${opts.length}.`);
  }
  const cols = entity.fields.map((f) => f.name);
  const vals = cols.map((c) => values[c] as string | number | null);
  if (idRaw === "new") {
    db().prepare(`INSERT INTO ${entity.table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...vals);
  } else {
    const id = Number(idRaw);
    if (!Number.isInteger(id)) redirect(`/admin/${entityKey}`);
    db().prepare(`UPDATE ${entity.table} SET ${cols.map((c) => `${c} = ?`).join(",")} WHERE id = ?`).run(...vals, id);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/${entityKey}?saved=1`);
}

export async function deleteEntity(entityKey: string, fd: FormData) {
  await requireAdmin();
  const entity = entityByKey(entityKey);
  if (!entity) redirect("/admin");
  const id = Number(fd.get("id"));
  if (Number.isInteger(id)) db().prepare(`DELETE FROM ${entity.table} WHERE id = ?`).run(id);
  revalidatePath("/", "layout");
  redirect(`/admin/${entityKey}?deleted=1`);
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const up = db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db().transaction(() => {
    for (const f of SETTING_FIELDS) {
      if (!(f.key in DEFAULT_SETTINGS)) continue;
      let v: string;
      if (f.kind === "bool") v = fd.get(f.key) === "on" ? "1" : "0";
      else {
        v = String(fd.get(f.key) ?? "").trim();
        if (f.kind === "color" && !/^#[0-9a-fA-F]{6}$/.test(v)) v = DEFAULT_SETTINGS[f.key];
        if (f.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = DEFAULT_SETTINGS[f.key];
        if (f.kind === "theme" && !["tape", "phosphor", "amber", "mono", "paper"].includes(v)) v = "tape";
      }
      up.run(f.key, v);
    }
  })();
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

export async function moderateComment(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const action = String(fd.get("action"));
  const tape = Number(fd.get("tape_id"));
  if (Number.isInteger(id)) {
    if (action === "approve") db().prepare("UPDATE comments SET status='visible' WHERE id=?").run(id);
    else if (action === "hide") db().prepare("UPDATE comments SET status='hidden' WHERE id=?").run(id);
    else if (action === "delete") db().prepare("DELETE FROM comments WHERE id=?").run(id);
  }
  if (Number.isInteger(tape)) revalidatePath(`/tapes/${tape}`);
  revalidatePath("/admin/moderation");
}

export async function updateUser(fd: FormData) {
  const me = await requireAdmin();
  const id = Number(fd.get("id"));
  const action = String(fd.get("action"));
  if (!Number.isInteger(id) || id === me.id) return; // you cannot change yourself here
  if (action === "make_admin") db().prepare("UPDATE users SET role='admin' WHERE id=?").run(id);
  else if (action === "make_user") db().prepare("UPDATE users SET role='user' WHERE id=?").run(id);
  else if (action === "ban") db().prepare("UPDATE users SET banned=1 WHERE id=?").run(id);
  else if (action === "unban") db().prepare("UPDATE users SET banned=0 WHERE id=?").run(id);
  else if (action === "delete") db().prepare("DELETE FROM users WHERE id=?").run(id);
  revalidatePath("/admin/users");
}

export async function resetAllContent(fd: FormData) {
  await requireAdmin();
  if (String(fd.get("confirm")).trim() !== "RESET") redirect("/admin?error=Type+RESET+to+confirm");
  resetContent(db());
  revalidatePath("/", "layout");
  redirect("/admin?reset=1");
}

