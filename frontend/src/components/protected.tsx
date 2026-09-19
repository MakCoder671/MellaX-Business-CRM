"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";

export function Protected({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !account) {
      router.replace("/login");
    }
  }, [loading, account, router]);

  if (loading || !account) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
