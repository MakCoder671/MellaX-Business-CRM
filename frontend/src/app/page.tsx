"use client";

import Link from "next/link";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/form";

export default function Home() {
  const { account, loading } = useAuth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold text-emerald-700">MellaX</h1>
      <p className="mt-2 max-w-md text-gray-600">
        Real business tools for small service businesses — CRM, invoicing, and
        more, without enterprise-software prices.
      </p>
      <div className="mt-6 flex gap-3">
        {!loading && account ? (
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        ) : (
          <>
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">Log in</Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
