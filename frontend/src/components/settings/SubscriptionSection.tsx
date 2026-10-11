"use client";

import { useEffect, useState } from "react";
import { Check, Wallet } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, ErrorText } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// ----------------------------------------------------------------------------
// Plan + trial status, and the Basic/Plus switcher. There's no real
// billing processor connected for MellaX's own subscriptions yet (that's
// a separate thing from the per-business Stripe keys under Integrations,
// which are for THEIR clients' card payments) — switching plans here is
// instant and free, since nothing is actually being charged today. See
// the big comment on BusinessAccount in accounts/models.py.
// ----------------------------------------------------------------------------

type Subscription = {
  plan_tier: "basic" | "plus" | "premium";
  subscription_status: "trialing" | "active" | "canceled";
  trial_ends_at: string;
  canceled_at: string | null;
  trial_days_left: number;
};

const PLANS = [
  { id: "basic" as const, name: "Basic", price: "$9.99/mo", blurb: "The core CRM + invoicing loop." },
  { id: "plus" as const, name: "Plus", price: "$19.99/mo", blurb: "Adds client booking, card payments, and campaigns." },
];

export function SubscriptionSection() {
  const { refreshAccount } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [switching, setSwitching] = useState<"basic" | "plus" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiFetch<Subscription>("/api/accounts/subscription/").then(setSub);
  }

  useEffect(load, []);

  async function switchTo(plan: "basic" | "plus") {
    setSwitching(plan);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch<Subscription>("/api/accounts/subscription/change-plan/", {
        method: "POST",
        body: { plan_tier: plan },
      });
      setSub(updated);
      // So anything elsewhere on the page gated by plan (nav items, Plus-only
      // buttons) updates immediately too, not just this one settings card.
      await refreshAccount();
      setMessage(`Switched to ${plan === "plus" ? "Plus" : "Basic"}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't switch plans. Try again.");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <SettingsSection
      icon={Wallet}
      title="Plan"
      description="Switch anytime. Changes take effect right away."
      tourId="settings-subscription"
    >
      {sub && sub.subscription_status === "trialing" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You&apos;re on a demo account{sub.trial_days_left > 0 && ` - ${sub.trial_days_left} ${sub.trial_days_left === 1 ? "day" : "days"} left before we check in`}.
          Everything&apos;s open to explore except connecting a payment processor, which unlocks once your account
          is activated.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent = sub?.plan_tier === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 ${isCurrent ? "border-[var(--accent-500,#10b981)] ring-1 ring-[var(--accent-500,#10b981)]" : "border-gray-200"}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{plan.name}</p>
                {isCurrent && (
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    <Check className="h-3 w-3" strokeWidth={3} /> Current plan
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-gray-700">{plan.price}</p>
              <p className="mt-1 text-xs text-gray-500">{plan.blurb}</p>
              {!isCurrent && (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={switching !== null}
                  onClick={() => switchTo(plan.id)}
                >
                  {switching === plan.id ? "Switching…" : `Switch to ${plan.name}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {message && <span className="text-sm text-emerald-700">{message}</span>}
        <ErrorText>{error}</ErrorText>
      </div>
    </SettingsSection>
  );
}
