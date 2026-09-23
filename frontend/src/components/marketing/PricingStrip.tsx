import Link from "next/link";
import { Check } from "lucide-react";

// Kept as data, matching the same plan ids/prices used on the actual
// signup form (see signup/page.tsx's PLANS) — this is a preview of that
// choice, not a separate source of truth for pricing.
const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "$9.99",
    blurb: "The core CRM + invoicing loop, fully usable on its own.",
    perks: ["Unlimited clients", "Invoicing & payments tracking", "Email support"],
    featured: false,
  },
  {
    id: "plus" as const,
    name: "Plus",
    price: "$19.99",
    blurb: "Everything in Basic, plus client-facing booking and marketing.",
    perks: [
      "Everything in Basic",
      "Client self-booking page",
      "Campaigns & landing pages",
    ],
    featured: true,
  },
];

// The "no, really, that's the whole price" section — flat, transparent
// numbers instead of the "Contact us" / "Talk to sales" pattern most
// business software hides its pricing behind.
export function PricingStrip() {
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
      </div>
    </section>
  );
}
