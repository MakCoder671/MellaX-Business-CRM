"use client";

import Link from "next/link";
import { use, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

export default function ResetPasswordPage({
  params,
}: PageProps<"/reset-password/[uidb64]/[token]">) {
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <Card className="mt-6 p-6">
        {done ? (
          <div className="space-y-3 text-sm text-gray-700">
            <p>Password updated.</p>
            <Link href="/login" className="text-emerald-700 underline">
              Log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="New password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
