"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Check, PartyPopper, Users, Wrench, type LucideIcon } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card } from "@/components/form";

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
// their only client later and an item un-checks itself.
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
};

export function GettingStarted() {
  const { account } = useAuth();
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [forceOpen, setForceOpen] = useState(false); // true only when the user manually clicks "Getting Started" to reopen it later

  useEffect(() => {
    apiFetch<unknown[]>("/api/services/").then((s) => setServiceCount(s.length));
    apiFetch<unknown[]>("/api/clients/").then((c) => setClientCount(c.length));
  }, []);

  if (serviceCount === null || clientCount === null || !account) return null; // still loading — nothing to show yet either way

  const items: ChecklistItem[] = [
    {
      label: "Add your logo and branding",
      description:
        "Shows up on invoices, your public booking page, and marketing emails, so clients see your business, not a generic template.",
      href: "/dashboard/settings",
      done: Boolean(account.logo),
      icon: Building2,
    },
    {
      label: "Add your first service",
      description:
        "Whatever you charge for, a haircut, a lawn job, a consultation. This is what shows up when you book an appointment or create an invoice.",
      href: "/dashboard/services",
      done: serviceCount > 0,
      icon: Wrench,
    },
    {
      label: "Add your first client",
      description:
        "Their contact info, appointment history, and every invoice all live on one profile. No more digging through texts or spreadsheets to find it.",
      href: "/dashboard/clients",
      done: clientCount > 0,
      icon: Users,
    },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const remaining = items.length - doneCount;
  const setupComplete = remaining === 0;
  const percent = Math.round((doneCount / items.length) * 100);

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
    // transparent backdrop.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold">Let&apos;s get your business set up</h2>
        <p className="mt-1 text-sm text-gray-500">
          A few quick things to do before you&apos;re fully up and running. Each one only takes a minute.
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>
              {doneCount} of {items.length} complete
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
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setForceOpen(false)} // close the popup when navigating away to actually go do the task
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
                      visually shift under it. */}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      item.done ? "accent-bg" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {item.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${item.done ? "text-emerald-700" : "text-gray-900"}`}>{item.label}</p>
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
