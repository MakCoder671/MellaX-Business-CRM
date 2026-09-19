"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";

// ----------------------------------------------------------------------------
// A wrapper component that bounces you to /login if you're not logged
// in. Used by wrapping it around a page's content — see
// app/dashboard/layout.tsx and app/onboarding/page.tsx for real examples:
//
//   <Protected>
//     <p>You can only see this if you're logged in</p>
//   </Protected>
// ----------------------------------------------------------------------------

export function Protected({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until `loading` is false before deciding to redirect — otherwise
    // we'd bounce someone to /login for a split second on every page
    // load, even if they turn out to actually be logged in (we just
    // haven't finished checking yet).
    if (!loading && !account) {
      router.replace("/login"); // replace() instead of push() so "back" doesn't return to the protected page they got bounced from
    }
  }, [loading, account, router]);

  if (loading || !account) {
    // Show a simple loading state instead of a flash of the protected
    // content (or a blank page) while we're still figuring out whether
    // someone's logged in.
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
