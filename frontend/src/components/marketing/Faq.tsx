"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Short, specific answers to the questions someone's actually weighing
// before they put in a card number — plan differences especially, since
// that's the easiest thing to get a wrong impression of from a pricing
// page alone.
const QUESTIONS = [
  {
    q: "Can I take card payments on the Basic plan?",
    a: "Not directly through MellaX. Basic covers cash, check, Venmo, Zelle, and other payments you record by hand. To charge a card right on an invoice, you need the Plus plan and your own free Stripe account.",
  },
  {
    q: "Do I need a Stripe account?",
    a: "Only if you want card payments. Connecting one is free, it's your own account, and the money goes straight to you. MellaX never holds your funds or sees your clients' card numbers.",
  },
  {
    q: "What does \"one-time fee\" mean for Zapier, Slack, and Mailchimp?",
    a: "You pay once to connect one of those, on either plan, instead of an extra monthly charge. Apple Calendar is different: it's free on every plan, no purchase needed.",
  },
  {
    q: "Can I switch plans or cancel later?",
    a: "Yes. Change plans or cancel from Settings whenever you want. There's no contract and no cancellation fee.",
  },
  {
    q: "Is my clients' data safe?",
    a: "Each business's data is kept separate from every other business on MellaX, and card numbers are never stored on our servers; Stripe handles those directly. See the Privacy Policy for the full picture.",
  },
] as const;

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h2 className="text-balance text-center font-display text-3xl font-bold text-ink sm:text-4xl">
        Questions people actually ask
      </h2>

      <div className="mt-10 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-card">
        {QUESTIONS.map((item, i) => {
          const open = openIndex === i;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="font-semibold text-ink">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {open && <p className="px-5 pb-4 text-sm leading-relaxed text-ink/65">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
