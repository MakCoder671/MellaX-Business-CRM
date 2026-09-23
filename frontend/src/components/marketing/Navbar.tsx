"use client";

import Link from "next/link";

import { useAuth } from "@/lib/auth-context";

// The marketing site's top nav. Doubles as the landing page's entry
// point into auth — "Log in" always sits right here, front and center,
// rather than being buried somewhere a first-time visitor has to hunt
// for it.
export function Navbar() {
  const { account, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-ink">
          MellaX
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-ink/70 md:flex">
          <a href="#features" className="transition-colors hover:text-ink">
            Features
          </a>
          <a href="#pricing" className="transition-colors hover:text-ink">
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-3">
          {!loading && account ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-ink transition-colors hover:text-brand"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
