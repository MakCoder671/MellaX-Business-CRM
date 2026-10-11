"use client";

import Link from "next/link";
import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { ErrorText } from "@/components/form";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";

// ----------------------------------------------------------------------------
// The signup form — steps 1, 2, and 4 of the plan doc's Sign-Up &
// Onboarding Flow all happen right here on one page (create account +
// accept terms + choose plan). Step 3 (email verification) and beyond
// happen on separate pages after this one submits successfully.
// ----------------------------------------------------------------------------

// Plan options shown as cards. Kept as plain data (not hardcoded JSX)
// so adding a plan later is just adding an entry to this array.
const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "$9.99/mo",
    blurb: "The core CRM + invoicing loop, fully usable on its own.",
  },
  {
    id: "plus" as const,
    name: "Plus",
    price: "$19.99/mo",
    blurb: "Adds client-facing booking, payments, marketing, and documents.",
  },
];

export default function SignupPage() {
  // Every form field gets its own bit of state — this is the standard
  // "controlled input" pattern in React: the <input>'s value always
  // comes FROM this state, and onChange updates the state, so React is
  // always the source of truth for what's in the box.
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTos, setAcceptTos] = useState(false);
  const [plan, setPlan] = useState<"basic" | "plus">("basic");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false); // disables the button + shows "Creating account…" while the request is in flight
  const [done, setDone] = useState(false); // flips to true after a successful signup, to show the "check your email" screen

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser from doing a full page reload on form submit — we handle it with JS instead
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/signup/", {
        method: "POST",
        auth: false, // no token exists yet — we're creating the account that WILL get one
        body: {
          business_name: businessName,
          email,
          password,
          accept_tos: acceptTos,
          plan_tier: plan,
        },
      });
      setDone(true);
    } catch (err) {
      // ApiError (see lib/api.ts) already has a nice human-readable
      // message; anything else (like a network failure) gets a generic
      // fallback instead of showing something scary/technical.
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // After a successful signup, show a "check your email" message instead
  // of the form — swapping the whole page content based on `done` is
  // simpler here than routing to a whole separate page for one message.
  if (done) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a verification link to ${email}.`}
        footer={
          <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
            Go to login
          </Link>
        }
      >
        <p className="text-sm text-ink/70">
          Open the link we sent to finish verifying your account, then log in to start setting up your business.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Real business tools, without enterprise prices."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Business name"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-ink/80">Choose your plan</p>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            {/* Two clickable cards instead of a dropdown/radio buttons —
                makes the price/description visible at a glance instead
                of hidden behind a click. */}
            {PLANS.map((p) => (
              <button
                type="button" // "button" (not "submit") so clicking a plan card doesn't accidentally submit the whole form
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  plan === p.id
                    ? "border-brand ring-1 ring-brand bg-brand-light/40"
                    : "border-ink/15 hover:border-ink/30"
                }`}
              >
                <span className="block font-medium text-ink">{p.name}</span>
                <span className="block text-brand font-semibold">{p.price}</span>
                <span className="mt-1 block text-xs text-ink/55">{p.blurb}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink/45">
            Billing isn&apos;t connected yet. Your account is created on this
            plan now, and card collection via Stripe is coming before
            launch.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            required
            checked={acceptTos}
            onChange={(e) => setAcceptTos(e.target.checked)}
            className="mt-1"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-brand underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-brand underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <ErrorText>{error}</ErrorText>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
