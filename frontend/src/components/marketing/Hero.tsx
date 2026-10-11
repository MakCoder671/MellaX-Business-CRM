import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { BrowserFrame } from "./BrowserFrame";

// The sales pitch, in one screen: what MellaX is, who it's for, and the
// one thing that actually matters to a solo owner comparing CRMs — the
// price. `<mark>` (styled via .mark-highlight in globals.css) does the
// same job a real highlighter would on a printed flyer.
//
// The right side is a real screenshot of the dashboard (see
// BrowserFrame), not an illustration — per Mako, a stranger deciding
// whether to sign up should see the actual software, not a drawing of
// someone vaguely happy at a laptop.
export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center rounded-full border border-brand/20 bg-brand-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            Built for businesses of one
          </p>

          <h1 className="mt-5 text-balance font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
            Run your business like the big guys.{" "}
            <mark className="mark-highlight">Pay like the solo founder</mark> you
            are.
          </h1>

          <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-ink/70">
            Clients, invoicing, scheduling, and marketing, all in one CRM that
            doesn&apos;t need a sales call, a demo, or an enterprise budget to
            get started.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-ink/15 px-6 py-3 text-base font-semibold text-ink transition-colors hover:border-ink/30"
            >
              Log in
            </Link>
          </div>

          <ul className="mt-8 flex flex-col gap-2 text-sm text-ink/60 sm:flex-row sm:gap-6">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />
              No setup fees
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />
              Cancel anytime
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />
              Plans from $9.99/mo
            </li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:mx-0">
          <div
            className="pointer-events-none absolute -inset-2 -z-10 rounded-[2rem] bg-brand/10 blur-2xl sm:-inset-6"
            aria-hidden="true"
          />
          <BrowserFrame src="/images/shot-dashboard.png" alt="The MellaX dashboard, showing today's bookings, revenue, and the calendar" />

          <div className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-2xl border border-ink/10 bg-card px-4 py-3 shadow-lg sm:-left-8">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand-dark">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-ink">Invoice #1001 paid</p>
              <p className="text-xs text-ink/50">Sent, viewed, and paid the same day</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
