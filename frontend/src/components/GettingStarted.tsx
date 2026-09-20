"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  href: string;
  done: boolean;
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
    { label: "Add your logo and branding", href: "/dashboard/settings", done: Boolean(account.logo) },
    { label: "Add your first service", href: "/dashboard/services", done: serviceCount > 0 },
    { label: "Add your first client", href: "/dashboard/clients", done: clientCount > 0 },
  ];
  const remaining = items.filter((i) => !i.done).length;
  const setupComplete = remaining === 0;

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
    // Collapses into a small text link once dismissed (or once setup is
    // complete) — always available so someone can reopen the checklist
    // any time they want, rather than it disappearing forever.
    return (
      <button onClick={() => setForceOpen(true)} className="text-sm text-emerald-700 underline">
        Getting Started{remaining > 0 ? ` (${remaining} left)` : ""}
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
          A few quick things to do before you&apos;re fully up and running.
        </p>

        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setForceOpen(false)} // close the popup when navigating away to actually go do the task
                className={`flex items-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                  item.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span>{item.done ? "✓" : "○"}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={dismiss}>
            I&apos;ll do this later
          </Button>
        </div>
      </Card>
    </div>
  );
}
