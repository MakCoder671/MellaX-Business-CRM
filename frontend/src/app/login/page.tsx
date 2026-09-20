"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText, Field } from "@/components/form";

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">Log in to MellaX</h1>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>

      <div className="mt-4 flex justify-between text-sm text-gray-600">
        <Link href="/forgot-password" className="text-emerald-700 underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-emerald-700 underline">
          Create an account
        </Link>
      </div>
    </main>
  );
}
