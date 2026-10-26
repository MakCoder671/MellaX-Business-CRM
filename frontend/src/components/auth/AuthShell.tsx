import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

const PERKS = [
  "No contracts, cancel any time",
  "Set up your first client in minutes",
  "Everything in one place: clients, invoices, bookings",
];

// The two-panel shell shared by every auth screen (login, signup,
// forgot/reset-password, verify-email). The brand panel only shows on
// large screens — on mobile it's just the form, full width, so there's
// no wasted scroll before someone can actually log in.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex flex-1">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-brand-dark p-10 text-white lg:flex xl:p-14">
        {/* Soft glows + a faint grid, purely decorative. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand opacity-60 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-highlight opacity-15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />

        <Link href="/" className="relative font-display text-xl font-bold tracking-tight">
          MellaX
        </Link>

        <div className="relative">
          <p className="font-display text-3xl font-bold leading-tight text-balance xl:text-4xl">
            Run your business like the big guys.{" "}
            <span className="text-highlight">Pay like the solo founder</span>{" "}
            you are.
          </p>
          <ul className="mt-10 flex flex-col gap-3">
            {PERKS.map((perk) => (
              <li
                key={perk}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 backdrop-blur-sm"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} MellaX. All rights reserved.
        </p>
      </div>

      <div className="relative flex flex-1 flex-col justify-center overflow-hidden bg-cream px-4 py-12 sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-brand-light opacity-70 blur-3xl"
        />

        <div className="auth-rise relative mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-ink lg:hidden"
          >
            MellaX
          </Link>

          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink lg:mt-0">
            {title}
          </h1>
          <p className="mt-2 text-sm text-ink/60">{subtitle}</p>

          <div className="mt-8 rounded-3xl border border-ink/[0.08] bg-card p-6 shadow-[0_1px_2px_rgba(22,21,43,0.04),0_12px_32px_-12px_rgba(49,46,129,0.18)] sm:p-8">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-ink/60">{footer}</div>}
        </div>
      </div>
    </main>
  );
}
