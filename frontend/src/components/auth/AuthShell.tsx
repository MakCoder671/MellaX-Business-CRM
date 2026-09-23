import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

const PERKS = [
  "No contracts, cancel any time",
  "Set up your first client in minutes",
  "Everything in one place: clients, invoices, bookings",
];

// The two-panel shell shared by every auth screen (login now; signup,
// forgot/reset-password, verify-email can move onto this later without
// re-building the brand panel each time). The brand panel only shows on
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
      <div className="hidden w-[42%] flex-col justify-between bg-brand-dark p-10 text-white lg:flex">
        <Link href="/" className="font-display text-xl font-bold">
          MellaX
        </Link>

        <div>
          <p className="font-display text-3xl font-bold leading-tight text-balance">
            Run your business like the big guys.{" "}
            <span className="text-highlight">Pay like the solo founder</span>{" "}
            you are.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-sm text-white/80">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">
          © {new Date().getFullYear()} MellaX. All rights reserved.
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-cream px-4 py-12 sm:px-6">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="font-display text-xl font-bold text-ink lg:hidden"
          >
            MellaX
          </Link>

          <h1 className="mt-6 font-display text-2xl font-bold text-ink sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-ink/60">{subtitle}</p>

          <div className="mt-8 rounded-2xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-ink/60">{footer}</div>}
        </div>
      </div>
    </main>
  );
}
