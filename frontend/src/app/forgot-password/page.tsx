"use client";

import Link from "next/link";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/forgot-password/", {
        method: "POST",
        auth: false,
        body: { email },
      });
    } finally {
      // Notice there's no `catch` here — we intentionally show the SAME
      // "check your email" message no matter what happens. The backend
      // deliberately never reveals whether an email is actually
      // registered (see accounts/views.py's ForgotPasswordView) to avoid
      // leaking who has an account, so there's nothing useful to show an
      // error for here either.
      setSubmitting(false);
      setDone(true);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send a reset link."
      footer={
        <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
          Back to login
        </Link>
      }
    >
      {done ? (
        <p className="text-sm text-ink/70">If that email is registered, a reset link is on its way.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
