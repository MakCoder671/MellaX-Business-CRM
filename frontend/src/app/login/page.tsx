"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
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

      // Where do we send them after logging in? There's no explicit
      // "has this account finished onboarding?" flag in the database yet
      // — so we use a simple stand-in signal instead: if they have zero
      // clients, they've probably never been through the onboarding
      // wizard, so send them there. Otherwise, straight to the dashboard.
      const clients = await apiFetch<unknown[]>("/api/clients/");
      router.push(clients.length === 0 ? "/onboarding" : "/dashboard");
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
