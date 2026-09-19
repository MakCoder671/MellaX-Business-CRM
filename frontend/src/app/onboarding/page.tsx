"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Protected } from "@/components/protected";
import { Button, Card, ErrorText, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// The onboarding wizard from the plan doc: business info -> first
// service -> first client -> landing page appears. Each step is its own
// small component below, and OnboardingPage at the bottom just tracks
// "which step are we on" and swaps between them. Each step component
// takes an `onDone` callback — when a step finishes successfully, it
// calls onDone() to advance to the next one.
// ----------------------------------------------------------------------------

const STEPS = ["Business info", "First service", "First client", "Your landing page"] as const;

// The little progress bar at the top ("Business info -- First service --
// ...") that highlights which steps are done/current.
function StepHeader({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex gap-2 text-xs font-medium text-gray-400">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={`flex-1 border-t-2 pt-2 ${i <= step ? "border-emerald-600 text-emerald-700" : "border-gray-200"}`}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

// --- Step 1: Business info ---
function BusinessInfoStep({ onDone }: { onDone: () => void }) {
  const { refreshAccount } = useAuth(); // after saving, re-fetch the account so the rest of the app sees the updated phone/address right away
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // PATCH = "update just these fields" (as opposed to PUT, which
      // would expect the whole object) — see accounts/views.py's MeView.
      await apiFetch("/api/accounts/me/", { method: "PATCH", body: { phone, address } });
      await refreshAccount();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Business phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Field label="Business address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

// --- Step 2: First service ---
function FirstServiceStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/services/", {
        method: "POST",
        body: { name, price, is_taxable: true, description: "" },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        What&apos;s something you charge for? (e.g. &quot;Lawn Maintenance&quot;)
      </p>
      <Field label="Service name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Field
        label="Price"
        type="number"
        step="0.01"
        min="0"
        required
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

// --- Step 3: First client ---
function FirstClientStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/clients/", {
        method: "POST",
        body: { name, email, phone, notes: "" },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">Add your first client.</p>
      <Field label="Client name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

// --- Step 4: Landing page reveal (the last step — no onDone, just a "go to dashboard" button) ---
function LandingPageStep() {
  const { account } = useAuth();
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    // The backend auto-creates a landing page the first time it's asked
    // for (see landingpages/views.py's MyLandingPageView) — so just
    // fetching it here is enough to make sure one exists.
    apiFetch<{ slug: string }>("/api/landing-pages/me/").then((lp) => setSlug(lp.slug));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Your landing page is live — it doubles as onboarding and marketing for{" "}
        {account?.business_name}.
      </p>
      {slug && (
        <a
          href={`/l/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md border border-dashed border-gray-300 p-3 text-sm text-emerald-700 underline"
        >
          View your landing page →
        </a>
      )}
      <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
    </div>
  );
}

// --- The wizard itself: just tracks which step number we're on ---
export default function OnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <Protected>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <h1 className="text-2xl font-semibold">Let&apos;s set up your business</h1>
        <Card className="mt-6 p-6">
          <StepHeader step={step} />
          {/* Only ever render the ONE step component matching the
              current step number — the others aren't in the DOM at all. */}
          {step === 0 && <BusinessInfoStep onDone={() => setStep(1)} />}
          {step === 1 && <FirstServiceStep onDone={() => setStep(2)} />}
          {step === 2 && <FirstClientStep onDone={() => setStep(3)} />}
          {step === 3 && <LandingPageStep />}
        </Card>
      </main>
    </Protected>
  );
}
