"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction, loginAction, registerAction, type FormState } from "@/app/actions/auth";

const init: FormState = {};

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? loginAction : registerAction, init);
  return (
    <form action={action} className="form">
      <input type="hidden" name="next" value={next} />
      <label>
        Username
        <input type="text" name="username" autoComplete="username" required minLength={3} maxLength={24} />
        {mode === "register" && <small>3 to 24 letters, numbers or underscores.</small>}
      </label>
      <label>
        Password
        <input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} />
        {mode === "register" && <small>At least 8 characters.</small>}
      </label>
      {mode === "register" && (
        <label>
          Repeat password
          <input type="password" name="confirm" autoComplete="new-password" required minLength={8} maxLength={128} />
        </label>
      )}
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn fill" type="submit" disabled={pending}>{pending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
      <p className="small">
        {mode === "login" ? <>No account? <Link href={`/register?next=${encodeURIComponent(next)}`}>Sign up</Link></> : <>Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>}
      </p>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, init);
  return (
    <form action={action} className="form">
      <label>
        Current password
        <input type="password" name="current" autoComplete="current-password" required />
      </label>
      <label>
        New password
        <input type="password" name="next" autoComplete="new-password" required minLength={8} maxLength={128} />
      </label>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg">{state.ok}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Working…" : "Change password"}</button>
    </form>
  );
}
