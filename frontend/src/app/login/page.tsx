"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CircleAlert, Loader2 } from "lucide-react";

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
  // Stays true after a successful login until the dashboard actually loads.
  // router.push() doesn't wait for the next page, so without this the
  // button would flip back to "Log in" while the dashboard is still on its
  // way — which reads as "my click didn't do anything."
  const [redirecting, setRedirecting] = useState(false);
  // Bumped on every failed attempt so the error banner re-animates even
  // when the message is the same as last time.
  const [errorKey, setErrorKey] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      setRedirecting(true);
      // Always straight to the dashboard — even for a brand new account.
      // No blocking setup wizard; the dashboard itself shows a
      // "Getting Started" checklist popup for anyone who hasn't finished
      // setup yet (see dashboard/page.tsx's <GettingStarted />).
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setErrorKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || redirecting;

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
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={busy}>
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@business.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <AuthField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="rounded text-sm font-medium text-brand transition-colors hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <div aria-live="polite" className="empty:hidden">
          {error && (
            <div
              key={errorKey}
              role="alert"
              className="auth-shake flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="group relative flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.7)] transition-all duration-150 hover:bg-brand-dark hover:shadow-[0_10px_24px_-10px_rgba(49,46,129,0.8)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 disabled:active:scale-100"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {redirecting ? "Opening your dashboard…" : "Logging in…"}
            </>
          ) : (
            <>
              Log in
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
