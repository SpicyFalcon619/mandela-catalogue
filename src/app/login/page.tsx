import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getUser, safeNext } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getUser()) redirect(next);
  return (
    <main className="authbox">
      <h1>Sign in</h1>
      <AuthForm mode="login" next={next} />
    </main>
  );
}
