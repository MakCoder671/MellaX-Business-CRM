"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarPlus,
  Check,
  Package,
  PartyPopper,
  Receipt,
  Settings2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card } from "@/components/form";
import { readTourCompleted, useTour } from "@/components/onboarding/TourContext";

// ----------------------------------------------------------------------------
// The "Getting Started" checklist — replaces the old forced step-by-step
// wizard. Instead of blocking a brand new account behind a multi-page
// flow before they see anything, they land straight in the (empty)
// dashboard, and this pops up on top of it as a friendly to-do list:
// add your logo, add a service, add a client, and so on. Each item links
// straight to the real page where that gets done — completing tasks by
// actually using the app, not by clicking "Next" through a wizard.
//
// Per Mako: this needed to be more directional and self-explanatory —
// numbered steps instead of a flat list, a short "here's why this
// matters" line under each not-yet-done item (not just a bare label),
// and a real progress bar so "how far along am I" is answered at a
// glance instead of having to count checkmarks. The done items stay
// terse once completed (no need to keep re-explaining something already
// finished) — only what's still ahead gets the fuller explanation,
// which is also what keeps attention pointed at what to do NEXT.
//
// Each item's "done" state is computed from REAL data (do you have a
// logo? any services? any clients?) rather than a stored "onboarding
// step" flag — so it always reflects reality, even if someone deletes
// their only client later and an item un-checks itself. The one
// exception is "Customize your settings": theme/tax/calendar settings
// all have perfectly legitimate defaults, so there's no real fact to
// check for "incomplete" there — that one item's done-state is "did you
// finish the tour" instead (see readTourCompleted in TourContext.tsx).
// ----------------------------------------------------------------------------

// The key used to remember "the user closed this" in the browser's own
// storage — kept client-side only (never synced to the backend) since
// it's just a per-device UI preference, not real account data.
const DISMISSED_KEY = "mellax_getting_started_dismissed";

// Reads localStorage exactly once, as the initial value of a useState
// below — NOT inside a useEffect. That distinction matters: setting
// state from an effect after the fact causes an extra render (and trips
// a lint rule against it); reading it as the state's starting value
// costs nothing extra and avoids that whole issue.
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    // localStorage can throw in rare cases (private browsing, locked-down
    // browser settings) — just treat that the same as "not dismissed yet."
    return false;
  }
}

type ChecklistItem = {
  label: string;
  description: string;
  href: string;
  done: boolean;
  icon: LucideIcon;
  // Which guided tour (see components/onboarding/TourContext.tsx) starts
  // when this item is clicked — points at the real field to use on the
  // destination page instead of just dropping someone on the page to
  // figure it out themselves.
  tourId: string;
  // Optional items (Products) don't block "All set up" and don't count
  // toward the progress bar — see requiredItems below. They still show
  // up in the list and still get their own tour, just with an "Optional"
  // tag instead of a step number.
  optional?: boolean;
};

export function GettingStarted() {
  const { account } = useAuth();
  const { startTour } = useTour();
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null);
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [forceOpen, setForceOpen] = useState(false); // true only when the user manually clicks "Getting Started" to reopen it later

  useEffect(() => {
    apiFetch<unknown[]>("/api/services/").then((s) => setServiceCount(s.length));
    apiFetch<unknown[]>("/api/clients/").then((c) => setClientCount(c.length));
    apiFetch<unknown[]>("/api/products/").then((p) => setProductCount(p.length));
    apiFetch<unknown[]>("/api/invoicing/invoices/").then((inv) => setInvoiceCount(inv.length));
    // Appointments aren't fetched by account directly — same chain the
    // Calendar widget itself uses (see useCalendarData.ts): look up the
    // account's one calendar, then that calendar's appointments.
    apiFetch<{ id: number }>("/api/scheduling/calendars/default/").then((cal) =>
      apiFetch<unknown[]>(`/api/scheduling/appointments/?calendar=${cal.id}`).then((a) =>
        setAppointmentCount(a.length)
      )
    );
  }, []);

  if (
    serviceCount === null ||
    clientCount === null ||
    productCount === null ||
    appointmentCount === null ||
    invoiceCount === null ||
    !account
  )
    return null; // still loading — nothing to show yet either way

  const items: ChecklistItem[] = [
    {
      label: "Add your logo and branding",
      description:
        "Shows up on invoices, your public booking page, and marketing emails, so clients see your business, not a generic template.",
      href: "/dashboard/settings",
      done: Boolean(account.logo),
      icon: Building2,
      tourId: "branding",
    },
    {
      label: "Customize your settings",
      description:
        "Pick a theme, set your time zone and hours, and set your tax rates. Everything that shapes how the app looks and how invoices and appointments get calculated.",
      href: "/dashboard/settings/theme",
      done: readTourCompleted("settings"),
      icon: Settings2,
      tourId: "settings",
    },
    {
      label: "Add your first service",
      description:
        "Whatever you charge for, a haircut, a lawn job, a consultation. This is what shows up when you book an appointment or create an invoice.",
      href: "/dashboard/services",
      done: serviceCount > 0,
      icon: Wrench,
      tourId: "service",
    },
    {
      label: "Add your first product",
      description:
        "Anything you sell on top of your services, like gear, retail items, or supplies. Shows up on invoices and tracks stock as you sell it.",
      href: "/dashboard/products",
      done: productCount > 0,
      icon: Package,
      tourId: "product",
      optional: true,
    },
    {
      label: "Add your first client",
      description:
        "Their contact info, appointment history, and every invoice all live on one profile. No more digging through texts or spreadsheets to find it.",
      href: "/dashboard/clients",
      done: clientCount > 0,
      icon: Users,
      tourId: "client",
    },
    {
      label: "Schedule an appointment",
      description:
        "Book a client in and see it land on your calendar. This is also what the next step turns into an invoice.",
      href: "/dashboard",
      done: appointmentCount > 0,
      icon: CalendarPlus,
      tourId: "appointment",
    },
    {
      label: "Create an invoice",
      description:
        "Bill a client for an appointment. This is how you actually get paid, and the last step of getting set up.",
      href: "/dashboard",
      done: invoiceCount > 0,
      icon: Receipt,
      tourId: "invoice",
    },
  ];

  // Progress only counts the required items — Products is a nice-to-have
  // that shouldn't hold "All set up" hostage.
  const requiredItems = items.filter((i) => !i.optional);
  const doneCount = requiredItems.filter((i) => i.done).length;
  const remaining = requiredItems.length - doneCount;
  const setupComplete = remaining === 0;
  const percent = Math.round((doneCount / requiredItems.length) * 100);

  // Step numbers (the little "1", "2", "3" badges) only count required
  // items too, so Products sitting in the middle of the list doesn't
  // leave a gap like 1, 2, _, 4. Built with reduce (not a mutated counter
  // inside the render .map() below) to keep the render itself pure.
  const numberedItems = items.reduce<{ count: number; list: (ChecklistItem & { number: number | null })[] }>(
    (acc, item) => {
      const count = item.optional ? acc.count : acc.count + 1;
      acc.list.push({ ...item, number: item.optional ? null : count });
      return { count, list: acc.list };
    },
    { count: 0, list: [] }
  ).list;

  // Plain derived value, computed fresh every render — no extra state,
  // no effect, so nothing here can trigger the "setState in an effect"
  // problem. Shows automatically for an incomplete, not-yet-dismissed
  // account, OR any time the user manually reopens it.
  const showModal = forceOpen || (!dismissed && !setupComplete);

  function dismiss() {
    setForceOpen(false);
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Fine to silently ignore — worst case, the checklist just pops up
      // again next visit, which isn't harmful.
    }
  }

  if (!showModal) {
    // Collapses into a small pill once dismissed (or once setup is
    // complete) — always available so someone can reopen the checklist
    // any time they want, rather than it disappearing forever. Still
    // shows real progress (a tiny bar + percent) even in this collapsed
    // state, per Mako, so "how far along am I" is visible at a glance
    // without needing to reopen the modal at all.
    return (
      <button onClick={() => setForceOpen(true)} className="group flex items-center gap-2 text-sm">
        {setupComplete ? (
          <span className="flex items-center gap-1.5 font-medium text-emerald-700">
            <PartyPopper className="h-4 w-4" strokeWidth={2} />
            All set up
          </span>
        ) : (
          <>
            <span className="text-gray-600 group-hover:text-gray-900">Getting started</span>
            <span className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-gray-200">
              <span className="accent-bg absolute inset-y-0 left-0 rounded-full" style={{ width: `${percent}%` }} />
            </span>
            <span className="font-medium text-gray-500">{percent}%</span>
          </>
        )}
      </button>
    );
  }

  return (
    // A simple full-screen overlay + centered card — a "modal" doesn't
    // need a component library, just fixed positioning and a semi-
    // transparent backdrop. max-h + overflow-y-auto on the Card itself:
    // the list has grown to 7 items since this was first built, tall
    // enough that it (and the "I'll do this later" button below it) can
    // run past a shorter viewport's bottom edge with nothing to scroll —
    // this is what keeps every item, and the dismiss button, reachable
    // regardless of screen height.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
      <Card className="max-h-full w-full max-w-md overflow-y-auto p-6">
        <h2 className="text-lg font-semibold">Let&apos;s get your business set up</h2>
        <p className="mt-1 text-sm text-gray-500">
          A few quick things to do before you&apos;re fully up and running. Each one only takes a minute.
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>
              {doneCount} of {requiredItems.length} complete
            </span>
            <span>{percent}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="accent-bg h-full rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {numberedItems.map((item) => {
            const Icon = item.icon;
            return (
              // tourId, not href — "Schedule an appointment" and "Create
              // an invoice" both link to /dashboard (the Calendar widget
              // lives right there), so href alone isn't a unique key.
              <li key={item.tourId}>
                <Link
                  href={item.href}
                  onClick={() => {
                    setForceOpen(false); // close the popup when navigating away to actually go do the task
                    if (!item.done) startTour(item.tourId); // point at the real field once we land on the page — a finished step doesn't need re-touring
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
                    item.done
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-gray-200 hover:border-[var(--accent-300,#6ee7b7)] hover:bg-gray-50"
                  }`}
                >
                  {/* The step badge doubles as an order indicator (1, 2,
                      3 — "directional," not just a flat list) and, once
                      done, swaps to a checkmark instead of re-numbering
                      the list, so a completed step's position doesn't
                      visually shift under it. Optional items (Products)
                      don't get a number at all — they're not part of that
                      required sequence, just an empty circle until done. */}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      item.done ? "accent-bg" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {item.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : item.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${item.done ? "text-emerald-700" : "text-gray-900"}`}>
                      {item.label}
                      {item.optional && !item.done && (
                        <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                          Optional
                        </span>
                      )}
                    </p>
                    {/* The "why this matters" bubble — only shown for
                        what's still ahead. A finished step doesn't need
                        re-explaining, and hiding it here is what keeps
                        the whole list from feeling cluttered as more
                        gets checked off. */}
                    {!item.done && (
                      <p className="mt-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs leading-relaxed text-gray-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${item.done ? "text-emerald-300" : "text-gray-300"}`}
                    strokeWidth={2}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">You can always finish this later.</p>
          <Button variant="secondary" onClick={dismiss}>
            I&apos;ll do this later
          </Button>
        </div>
      </Card>
    </div>
  );
}
