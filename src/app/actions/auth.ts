"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { endSession, getUser, hashPassword, safeNext, startSession, verifyPassword } from "@/lib/auth";
import { clientKey } from "@/lib/client-ip";
import { getSettings } from "@/lib/content";
import { tooMany } from "@/lib/rate";

export type FormState = { error?: string; ok?: string };

async function ip() {
  return clientKey(await headers());
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (getSettings().registration_open !== "1") return { error: "New sign-ups are closed right now." };
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return { error: "Username must be 3 to 24 letters, numbers or underscores." };
  if (password.length < 8 || password.length > 128) return { error: "Password must be 8 to 128 characters." };
  if (password !== confirm) return { error: "The two passwords do not match." };
  if (tooMany(`reg:${await ip()}`, 5, 60 * 60 * 1000)) return { error: "Too many sign-ups from this connection. Try again later." };
  const exists = db().prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) return { error: "That username is taken." };
  const res = db().prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, await hashPassword(password));
  await startSession(Number(res.lastInsertRowid));
  redirect(safeNext(fd.get("next")));
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (tooMany(`login:${await ip()}:${username.toLowerCase()}`, 6, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  const row = db().prepare("SELECT id, password_hash, banned FROM users WHERE username = ?").get(username) as
    | { id: number; password_hash: string; banned: number }
    | undefined;
  // Same message for unknown user and wrong password.
  if (!row || !(await verifyPassword(password, row.password_hash))) return { error: "Wrong username or password." };
  if (row.banned) return { error: "This account is suspended." };
  await startSession(row.id);
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Sign in first." };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 8 || next.length > 128) return { error: "New password must be 8 to 128 characters." };
  if (tooMany(`pw:${user.id}`, 5, 15 * 60 * 1000)) return { error: "Too many attempts. Wait a few minutes." };
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string } | undefined;
  if (!row || !(await verifyPassword(current, row.password_hash))) return { error: "Current password is wrong." };
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(next), user.id);
  return { ok: "Password changed." };
}
