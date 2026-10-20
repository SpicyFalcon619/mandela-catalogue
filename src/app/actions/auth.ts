"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { endSession, getUser, hashPassword, safeNext, startSession, verifyPassword } from "@/lib/auth";
import { clientKey } from "@/lib/client-ip";
import { getSettings } from "@/lib/content";
import { tooMany } from "@/lib/rate";

/** `username`, `body` and `kind` echo non-secret input back on errors so the form does not wipe what the visitor typed. */
export type FormState = { error?: string; ok?: string; username?: string; body?: string; kind?: string };

async function ip() {
  return clientKey(await headers());
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if ((await getSettings()).registration_open !== "1") return { error: "New sign-ups are closed right now." };
  const username = String(fd.get("username") ?? "").trim();
  const keep = (error: string): FormState => ({ error, username });
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return keep("Username must be 3 to 24 letters, numbers or underscores.");
  if (password.length < 8 || password.length > 128) return keep("Password must be 8 to 128 characters.");
  if (password !== confirm) return keep("The two passwords do not match.");
  if (await tooMany(`reg:${await ip()}`, 5, 60 * 60 * 1000)) return keep("Too many sign-ups from this connection. Try again later.");
  const exists = await sql.get("SELECT 1 FROM users WHERE username = ?", username);
  if (exists) return keep("That username is taken.");
  const res = await sql.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", username, await hashPassword(password));
  await startSession(res.lastId);
  redirect(safeNext(fd.get("next")));
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = String(fd.get("username") ?? "").trim();
  const keep = (error: string): FormState => ({ error, username });
  const password = String(fd.get("password") ?? "");
  if (await tooMany(`login:${await ip()}:${username.toLowerCase()}`, 6, 15 * 60 * 1000)) {
    return keep("Too many attempts. Wait a few minutes and try again.");
  }
  const row = await sql.get<{ id: number; password_hash: string; banned: number }>("SELECT id, password_hash, banned FROM users WHERE username = ?", username);
  // Same message for unknown user and wrong password.
  if (!row || !(await verifyPassword(password, row.password_hash))) return keep("Wrong username or password.");
  if (row.banned) return keep("This account is suspended.");
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
  if (await tooMany(`pw:${user.id}`, 5, 15 * 60 * 1000)) return { error: "Too many attempts. Wait a few minutes." };
  const row = await sql.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id);
  if (!row || !(await verifyPassword(current, row.password_hash))) return { error: "Current password is wrong." };
  await sql.run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(next), user.id);
  return { ok: "Password changed." };
}
