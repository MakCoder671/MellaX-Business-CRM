"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";

// Same idea as the reset-password page — this is where the "verify your
// email" link from the signup email actually lands. Unlike reset
// password though, there's no form to fill out: the moment this page
// loads, it immediately fires the verify request using the uid/token
// already in the URL (see the useEffect below).

export default function VerifyEmailPage({
  params,
}: PageProps<"/verify-email/[uidb64]/[token]">) {
  const { uidb64, token } = use(params);
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    // Fires automatically as soon as the page mounts — no button click
    // needed, since just landing on this URL (by clicking the emailed
    // link) IS the action being confirmed.
    apiFetch<{ detail: string }>(`/api/accounts/verify-email/${uidb64}/${token}/`, {
      method: "POST",
      auth: false,
    })
      .then((res) => {
        setStatus("success");
        setMessage(res.detail);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Something went wrong.");
      });
  }, [uidb64, token]);

  return (
    <AuthShell
      title="Verifying your email"
      subtitle="One moment."
      footer={
        status === "success" && (
          <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
            Log in
          </Link>
        )
      }
    >
      <p className={status === "error" ? "text-sm text-red-600" : "text-sm text-ink/70"}>{message}</p>
    </AuthShell>
  );
}
