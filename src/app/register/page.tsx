import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getUser, safeNext } from "@/lib/auth";
import { getSettings } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign up" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getUser()) redirect(next);
  if (getSettings().registration_open !== "1") {
    return (
      <main className="authbox">
        <h1>Sign-ups closed</h1>
        <p>New accounts are not being accepted right now.</p>
      </main>
    );
  }
  return (
    <main className="authbox">
      <h1>Sign up</h1>
      <p className="small">An account lets you post comments, fan theories and corrections, and keeps your display settings on every device.</p>
      <AuthForm mode="register" next={next} />
    </main>
  );
}
