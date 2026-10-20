"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { tooMany } from "@/lib/rate";
import type { FormState } from "./auth";

const KINDS = ["comment", "theory", "correction"] as const;

export async function postComment(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Sign in to post." };
  const settings = getSettings();
  const tapeId = Number(fd.get("tape_id"));
  const kind = String(fd.get("kind") ?? "comment");
  const body = String(fd.get("body") ?? "").trim();
  if (!(KINDS as readonly string[]).includes(kind)) return { error: "Unknown post type." };
  if (kind === "comment" && settings.comments_enabled !== "1") return { error: "Comments are turned off." };
  if (kind !== "comment" && settings.submissions_enabled !== "1") return { error: "Theories and corrections are turned off." };
  if (body.length < 3) return { error: "Write a little more." };
  if (body.length > 1500) return { error: "Keep it under 1,500 characters." };
  if (!Number.isInteger(tapeId) || !db().prepare("SELECT 1 FROM tapes WHERE id = ? AND published = 1").get(tapeId)) {
    return { error: "That tape does not exist." };
  }
  if (tooMany(`post:${user.id}`, 5, 60 * 1000)) return { error: "Slow down a little." };
  // Comments appear straight away. Theories and corrections wait for an admin, except admins' own.
  const status = kind === "comment" || user.role === "admin" ? "visible" : "pending";
  db().prepare("INSERT INTO comments (tape_id, user_id, kind, body, status) VALUES (?,?,?,?,?)").run(tapeId, user.id, kind, body, status);
  revalidatePath(`/tapes/${tapeId}`);
  return { ok: status === "pending" ? "Thanks. An admin will review it before it shows." : "Posted." };
}

export async function deleteOwnComment(commentId: number, tapeId: number) {
  const user = await getUser();
  if (!user) return;
  db().prepare("DELETE FROM comments WHERE id = ? AND user_id = ?").run(commentId, user.id);
  revalidatePath(`/tapes/${tapeId}`);
}
