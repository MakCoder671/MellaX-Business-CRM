"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Card } from "@/components/form";

export default function VerifyEmailPage({
  params,
}: PageProps<"/verify-email/[uidb64]/[token]">) {
  const { uidb64, token } = use(params);
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 text-center">
      <Card className="p-6">
        <p className={status === "error" ? "text-red-600" : "text-gray-700"}>{message}</p>
        {status === "success" && (
          <Link href="/login" className="mt-4 inline-block text-sm text-emerald-700 underline">
            Log in
          </Link>
        )}
      </Card>
    </main>
  );
}
