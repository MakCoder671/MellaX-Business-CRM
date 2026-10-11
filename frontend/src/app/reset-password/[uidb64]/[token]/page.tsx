"use client";

import Link from "next/link";
import { use, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { ErrorText } from "@/components/form";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";

// ----------------------------------------------------------------------------
// This page lives at a URL like /reset-password/MQ/abc123-xyz/ — the
// [uidb64] and [token] folder names (with square brackets) are Next.js's
// way of saying "these are dynamic parts of the URL, capture them as
// params." This is exactly the link the backend emails out (see
// accounts/views.py's ForgotPasswordView) — the account ID and a
// signed, tamper-proof token are baked right into the URL itself.
// ----------------------------------------------------------------------------

export default function ResetPasswordPage({
  params,
}: PageProps<"/reset-password/[uidb64]/[token]">) {
  // In Next.js 16, `params` arrives as a Promise (not a plain object like
  // older versions) — `use()` is a React hook that "unwraps" a promise
  // inside a component, kind of like an inline `await` for JSX.
  const { uidb64, token } = use(params);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // uidb64 and token both just get forwarded straight into the URL —
      // the backend does all the actual verifying (see
      // accounts/views.py's ResetPasswordView).
      await apiFetch(`/api/accounts/reset-password/${uidb64}/${token}/`, {
        method: "POST",
        auth: false,
        body: { password },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose something you haven't used here before."
      footer={
        !done && (
          <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
            Back to login
          </Link>
        )
      }
    >
      {done ? (
        <div className="space-y-3 text-sm text-ink/70">
          <p>Password updated.</p>
          <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
            Log in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
