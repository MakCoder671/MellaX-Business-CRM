"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import type { PublicLandingPage } from "./landing";

// The business's logo, or its first letter on a colored tile when there isn't
// one. Used in the header and the hero, so it's written once.
export function BusinessMark({ page, size }: { page: PublicLandingPage; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-16 w-16 text-2xl" : "h-9 w-9 text-sm";
  if (page.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={page.logo} alt="" className={`${box} shrink-0 rounded-xl object-cover`} />;
  }
  return (
    <span aria-hidden="true" className={`${box} accent-bg flex shrink-0 items-center justify-center rounded-xl font-bold`}>
      {page.business_name.charAt(0).toUpperCase()}
    </span>
  );
}

// Every link on the page is an anchor to a section below, so everything stays
// on one page the way the demo does. Only sections that have content appear.
export function LandingHeader({ page, canBook }: { page: PublicLandingPage; canBook: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "#about", label: "About", show: true },
    { href: "#services", label: "Services", show: page.services.length > 0 },
    { href: "#gallery", label: "Gallery", show: page.photos.length > 0 },
    { href: "#reviews", label: "Reviews", show: true },
    { href: "#visit", label: "Visit", show: true },
  ].filter((l) => l.show);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--lp-line)] bg-[var(--lp-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <a href="#top" className="flex min-w-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
          <BusinessMark page={page} size="sm" />
          <span className="truncate text-base font-semibold text-[var(--lp-text)]">{page.business_name}</span>
        </a>

        <nav aria-label="Page sections" className="hidden items-center gap-7 text-sm font-medium text-[var(--lp-muted)] md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-[var(--lp-text)]">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {canBook ? (
            <a href="#book" className="accent-bg hidden shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm sm:inline-block">
              Book now
            </a>
          ) : (
            page.phone && (
              <a
                href={`tel:${page.phone}`}
                className="hidden shrink-0 rounded-full border border-[var(--lp-line)] bg-[var(--lp-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--lp-text)] sm:inline-block"
              >
                Call
              </a>
            )
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="rounded-md p-2 text-[var(--lp-text)] hover:bg-[var(--lp-alt)] md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav aria-label="Mobile sections" className="border-t border-black/5 bg-[var(--lp-surface)] px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-[var(--lp-text)] hover:bg-[var(--lp-alt)]"
                >
                  {l.label}
                </a>
              </li>
            ))}
            {canBook && (
              <li>
                <a href="#book" onClick={() => setMenuOpen(false)} className="accent-bg mt-2 block rounded-full px-3 py-3 text-center text-base font-semibold">
                  Book an appointment
                </a>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
