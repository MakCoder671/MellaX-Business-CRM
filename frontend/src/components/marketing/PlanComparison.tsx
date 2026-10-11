import Link from "next/link";
import { Check, Minus } from "lucide-react";

// Kept as data, matching the same plan ids/prices used on the actual
// signup form (see signup/page.tsx's PLANS) — this is a preview of that
// choice, not a separate source of truth for pricing.
const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "$9.99",
    blurb: "The core CRM + invoicing loop, fully usable on its own.",
    perks: ["Unlimited clients", "Invoicing & payment tracking", "Your own booking page", "Email support"],
    featured: false,
  },
  {
    id: "plus" as const,
    name: "Plus",
    price: "$19.99",
    blurb: "Everything in Basic, plus a client-facing, automated front end.",
    perks: [
      "Everything in Basic",
      "Clients book themselves, synced to your calendar",
      "Card payments right on an invoice",
      "Shareable campaign links & QR codes",
    ],
    featured: true,
  },
];

// Every row here is checked against what's actually gated server-side
// (see common/permissions.py's IsPlusOrAbove and landingpages/models.py's
// booking_available) before it goes on this page — per Mako, nobody
// should sign up for Basic thinking they can take card payments, or for
// Plus thinking Zapier/Slack/Mailchimp are included free. `true` means
// included free on that plan; a string is shown as its own small label
// instead of a checkmark.
const ROWS: { feature: string; basic: boolean | string; plus: boolean | string }[] = [
  { feature: "Clients, with full history & notes", basic: true, plus: true },
  { feature: "Invoicing & payment tracking", basic: true, plus: true },
  { feature: "Scheduling & calendar", basic: true, plus: true },
  { feature: "Your own booking page", basic: true, plus: true },
  { feature: "Clients book themselves on that page", basic: false, plus: true },
  { feature: "Card payments on an invoice", basic: false, plus: true },
  { feature: "Apple Calendar sync", basic: true, plus: true },
  { feature: "Google Calendar sync", basic: "Coming soon", plus: "Coming soon" },
  { feature: "E-blast marketing with built-in templates", basic: true, plus: true },
  { feature: "Shareable campaign links, QR codes & lead tracking", basic: false, plus: true },
  { feature: "Reports, Profit & Loss, and the Tax Center", basic: true, plus: true },
  { feature: "Zapier, Slack & Mailchimp", basic: "One-time fee", plus: "One-time fee" },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-brand-light p-1 text-brand-dark">
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-white/10 p-1 text-white/40">
        <Minus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="text-xs font-semibold text-white/70">{value}</span>;
}

// The "no, really, that's the whole price" section — flat, transparent
// numbers instead of the "Contact us" / "Talk to sales" pattern most
// business software hides its pricing behind, followed by a row-by-row
// breakdown so nobody has to guess what's actually on their plan.
export function PlanComparison() {
  return (
    <section id="pricing" className="bg-brand-dark py-20 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-xl">
          <h2 className="text-balance font-display text-3xl font-bold sm:text-4xl">
            No sales calls. No hidden fees. Just a price.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-white/75">
            Pick a plan, put in a card, start using it in the next five
            minutes. Change or cancel whenever, no contract, no
            &quot;enterprise pricing available on request.&quot;
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:max-w-2xl">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.featured
                  ? "border-highlight bg-white text-ink"
                  : "border-white/15 bg-brand-dark text-white"
              }`}
            >
              {plan.featured && (
                <span className="mb-3 inline-flex w-fit items-center rounded-full bg-highlight px-2.5 py-1 text-xs font-semibold text-ink">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <p className={`mt-1 text-sm ${plan.featured ? "text-ink/60" : "text-white/60"}`}>
                {plan.blurb}
              </p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold">{plan.price}</span>
                <span className={`text-sm ${plan.featured ? "text-ink/50" : "text-white/50"}`}>
                  /mo
                </span>
              </p>

              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <Check
                      className={`h-4 w-4 shrink-0 ${plan.featured ? "text-brand" : "text-highlight"}`}
                      aria-hidden="true"
                    />
                    <span className={plan.featured ? "text-ink/75" : "text-white/75"}>{perk}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-6 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                  plan.featured
                    ? "bg-brand text-white hover:bg-brand-dark"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Start with {plan.name}
              </Link>
            </div>
          ))}
        </div>

        {/* The part the pricing cards above can only hint at: a straight,
            row-by-row answer to "wait, which plan actually has that?" —
            card payments especially, since that's the easiest thing to
            wrongly assume comes with every plan. */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-white/15">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/15 bg-white/5">
                <th className="px-5 py-3 font-semibold text-white/80">What&apos;s included</th>
                <th className="px-5 py-3 text-center font-semibold text-white/80">Basic</th>
                <th className="px-5 py-3 text-center font-semibold text-white/80">Plus</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 1 ? "bg-white/[0.03]" : undefined}>
                  <td className="px-5 py-3 text-white/80">{row.feature}</td>
                  <td className="px-5 py-3 text-center">
                    <Cell value={row.basic} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Cell value={row.plus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-2xl text-sm text-white/60">
          Card payments go through your own Stripe account, so MellaX never
          holds your money. Zapier, Slack, and Mailchimp are a one-time
          purchase to connect, on either plan, not a subscription on top of
          your subscription.
        </p>
      </div>
    </section>
  );
}
