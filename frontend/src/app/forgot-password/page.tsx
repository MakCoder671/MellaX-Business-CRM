"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button, Card, Field } from "@/components/form";

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
      setSubmitting(false);
      setDone(true);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <Card className="mt-6 p-6">
        {done ? (
          <p className="text-sm text-gray-700">
            If that email is registered, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
