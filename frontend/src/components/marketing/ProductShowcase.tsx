"use client";

import { useState } from "react";

import { BrowserFrame } from "./BrowserFrame";

// Real screenshots, not mockups — three different parts of the actual
// dashboard, picked over a tab instead of a flat grid so each one gets
// shown at a readable size. Items tagged "Plus" show a feature that
// isn't in Basic, so this section doesn't quietly promise more than a
// Basic account actually gets.
const ITEMS = [
  {
    key: "invoices",
    label: "Invoicing",
    plusOnly: false,
    caption: "Build an invoice, email it, and watch it flip to Paid the moment a payment is recorded.",
    src: "/images/shot-invoice.png",
    alt: "A paid MellaX invoice, with line items, totals, and payment history",
  },
  {
    key: "reports",
    label: "Reports",
    plusOnly: false,
    caption: "Real numbers in plain language: sales, profit after expenses, and how this period compares to last year.",
    src: "/images/shot-reports.png",
    alt: "The MellaX growth report, showing sales, average sale, and profit after expenses",
  },
  {
    key: "booking",
    label: "Client booking page",
    plusOnly: true,
    caption: "Every account gets a page like this. On Plus, clients can book straight onto your calendar from it.",
    src: "/images/shot-booking.png",
    alt: "A business's public MellaX page, with hours, an appointment button, and reviews",
  },
] as const;

export function ProductShowcase() {
  const [active, setActive] = useState<(typeof ITEMS)[number]["key"]>("invoices");
  const current = ITEMS.find((item) => item.key === active) ?? ITEMS[0];

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-xl">
        <h2 className="text-balance font-display text-3xl font-bold text-ink sm:text-4xl">
          This is the actual software.
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-ink/70">
          Not a mockup. These are real screens from a MellaX account, so
          there&apos;s no surprise once you sign up.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActive(item.key)}
            aria-pressed={item.key === active}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              item.key === active
                ? "bg-brand text-white"
                : "bg-ink/5 text-ink/60 hover:bg-ink/10"
            }`}
          >
            {item.label}
            {item.plusOnly && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                  item.key === active ? "bg-white/20" : "bg-highlight text-ink"
                }`}
              >
                PLUS
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-center">
        <BrowserFrame src={current.src} alt={current.alt} />
        <div>
          <p className="text-pretty text-lg leading-relaxed text-ink/70">{current.caption}</p>
          {current.plusOnly && (
            <p className="mt-3 text-sm font-medium text-brand-dark">
              This part is on the Plus plan. See what&apos;s included where below.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
