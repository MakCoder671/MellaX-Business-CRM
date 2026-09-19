"use client";

import Link from "next/link";
import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

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
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-gray-600">
          We sent a verification link to <strong>{email}</strong>. Verify your
          account, then log in to continue setting up your business.
        </p>
        <Link href="/login" className="mt-6 text-sm text-emerald-700 underline">
          Go to login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">Create your MellaX account</h1>
      <p className="mt-1 text-sm text-gray-600">
        Real business tools, without enterprise prices.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Business name"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div>
            <p className="text-sm font-medium text-gray-700">Choose your plan</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {/* Two clickable cards instead of a dropdown/radio buttons —
                  makes the price/description visible at a glance instead
                  of hidden behind a click. */}
              {PLANS.map((p) => (
                <button
                  type="button" // "button" (not "submit") so clicking a plan card doesn't accidentally submit the whole form
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={`rounded-md border p-3 text-left text-sm transition-colors ${
                    plan === p.id
                      ? "border-emerald-600 ring-1 ring-emerald-600"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-emerald-700">{p.price}</span>
                  <span className="mt-1 block text-xs text-gray-500">{p.blurb}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Billing isn&apos;t connected yet — your account is created on this
              plan now, and card collection via Stripe is coming before
              launch.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              required
              checked={acceptTos}
              onChange={(e) => setAcceptTos(e.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <ErrorText>{error}</ErrorText>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-700 underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
