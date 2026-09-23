"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { ErrorText } from "@/components/form";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth(); // the login() function actually lives in lib/auth-context.tsx — this page just calls it
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Always straight to the dashboard — even for a brand new account.
      // No blocking setup wizard; the dashboard itself shows a
      // "Getting Started" checklist popup for anyone who hasn't finished
      // setup yet (see dashboard/page.tsx's <GettingStarted />).
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to pick up right where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:text-brand-dark">
            Create one free
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-brand hover:text-brand-dark">
            Forgot password?
          </Link>
        </div>

        <ErrorText>{error}</ErrorText>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
