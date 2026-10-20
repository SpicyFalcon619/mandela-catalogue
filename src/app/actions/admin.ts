"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, sql, type Stmt } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_SETTINGS, SETTING_FIELDS } from "@/lib/defaults";
import { entityByKey, type Field } from "@/lib/entities";
import { resetContent } from "@/lib/seed";
import { youtubeHref } from "@/lib/youtube";
import { purgeTapeComments, purgeUser, removeComment } from "@/lib/comments";

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
    if (values.youtube_url !== "" && !youtubeHref(String(values.youtube_url))) fail(entityKey, idRaw, "The YouTube link must start with https://www.youtube.com/ or https://youtu.be/.");
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
    await sql.run(`INSERT INTO ${entity.table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...vals);
  } else {
    const id = Number(idRaw);
    if (!Number.isInteger(id)) redirect(`/admin/${entityKey}`);
    await sql.run(`UPDATE ${entity.table} SET ${cols.map((c) => `${c} = ?`).join(",")} WHERE id = ?`, ...vals, id);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/${entityKey}?saved=1`);
}

export async function deleteEntity(entityKey: string, fd: FormData) {
  await requireAdmin();
  const entity = entityByKey(entityKey);
  if (!entity) redirect("/admin");
  const id = Number(fd.get("id"));
  if (Number.isInteger(id)) {
    const stmts: Stmt[] = [];
    // Comments (with their votes and reports) belong to a tape; remove them explicitly rather than rely on cascades.
    if (entityKey === "tapes") stmts.push(...(await purgeTapeComments(id)));
    stmts.push({ sql: `DELETE FROM ${entity.table} WHERE id = ?`, args: [id] });
    await sql.batch(stmts);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/${entityKey}?deleted=1`);
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const stmts: Stmt[] = [];
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
    stmts.push({ sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [f.key, v] });
  }
  await sql.batch(stmts);
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

export async function moderateComment(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const action = String(fd.get("action"));
  const tape = Number(fd.get("tape_id"));
  if (Number.isInteger(id)) {
    if (action === "approve") await sql.run("UPDATE comments SET status='visible' WHERE id=?", id);
    else if (action === "hide") await sql.run("UPDATE comments SET status='hidden' WHERE id=?", id);
    else if (action === "delete") await removeComment(id);
  }
  if (Number.isInteger(tape)) revalidatePath(`/tapes/${tape}`);
  revalidatePath("/admin/moderation");
}

export async function updateUser(fd: FormData) {
  const me = await requireAdmin();
  const id = Number(fd.get("id"));
  const action = String(fd.get("action"));
  if (!Number.isInteger(id) || id === me.id) return; // you cannot change yourself here
  if (action === "make_admin") await sql.run("UPDATE users SET role='admin' WHERE id=?", id);
  else if (action === "make_user") await sql.run("UPDATE users SET role='user' WHERE id=?", id);
  else if (action === "ban") await sql.run("UPDATE users SET banned=1 WHERE id=?", id);
  else if (action === "unban") await sql.run("UPDATE users SET banned=0 WHERE id=?", id);
  else if (action === "delete") await purgeUser(id, me.id);
  revalidatePath("/admin/users");
}

export async function resetAllContent(fd: FormData) {
  await requireAdmin();
  if (String(fd.get("confirm")).trim() !== "RESET") redirect("/admin?error=Type+RESET+to+confirm");
  await resetContent(await getDb());
  revalidatePath("/", "layout");
  redirect("/admin?reset=1");
}

/** Pin one top-level comment to the top of its tape's discussion (or unpin it). Only one comment is pinned per tape. */
export async function pinComment(commentId: number, pinned: boolean) {
  await requireAdmin();
  const row = Number.isInteger(commentId)
    ? await sql.get<{ tape_id: number; depth: number; status: string; deleted: number }>("SELECT tape_id, depth, status, deleted FROM comments WHERE id = ?", commentId)
    : undefined;
  if (!row) return { ok: false as const, error: "That comment is gone." };
  if (pinned && (row.depth !== 0 || row.status !== "visible" || row.deleted)) {
    return { ok: false as const, error: "Only visible top-level comments can be pinned." };
  }
  await sql.batch([
    { sql: "UPDATE comments SET pinned = 0 WHERE tape_id = ?", args: [row.tape_id] },
    ...(pinned ? [{ sql: "UPDATE comments SET pinned = 1 WHERE id = ?", args: [commentId] }] : []),
  ]);
  revalidatePath(`/tapes/${row.tape_id}`);
  return { ok: true as const, pinnedId: pinned ? commentId : null };
}

/** From the moderation queue: "dismiss" closes the reports, "restore" also un-hides a comment the reports hid. */
export async function resolveReports(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const action = String(fd.get("action"));
  if (!Number.isInteger(id)) return;
  if (action === "dismiss" || action === "restore") {
    const stmts = [{ sql: "UPDATE comment_reports SET resolved = 1 WHERE comment_id = ?", args: [id] }];
    if (action === "restore") stmts.push({ sql: "UPDATE comments SET status = 'visible' WHERE id = ? AND status = 'hidden'", args: [id] });
    await sql.batch(stmts);
  }
  revalidatePath("/admin/moderation");
}
