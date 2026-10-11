import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink/10 bg-cream py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:text-left sm:px-6">
        <div>
          <p className="font-display text-lg font-bold text-ink">MellaX</p>
          <p className="text-sm text-ink/60">
            CRM &amp; invoicing for small service businesses.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-ink/70 sm:justify-start">
          <Link href="/login" className="transition-colors hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className="transition-colors hover:text-ink">
            Get started
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-ink">
            Privacy
          </Link>
        </div>

        <p className="text-xs text-ink/40">
          © {new Date().getFullYear()} MellaX. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
