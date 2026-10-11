"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, ErrorText } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// Canceling closes the account right away: signed out everywhere, no way
// to log back in until support turns it back on by hand. There's no real
// billing yet, so there's no "paid through" date to honor — see
// accounts/views.py's CancelSubscriptionView for the full reasoning.
// A two-step confirm (not the browser's plain confirm()) because this is
// the one button on this whole page that locks someone out of their own
// client and invoice data.
export function CancelSubscriptionSection() {
  const router = useRouter();
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/accounts/subscription/cancel/", { method: "POST" });
      logout();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel. Try again, or use Feedback & Support below.");
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection
      icon={ShieldAlert}
      title="Cancel subscription"
      description="Closes your account. Your data stays intact, you just can't log back in until it's reactivated."
      tourId="settings-cancel-subscription"
    >
      {!confirming ? (
        <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
          Cancel subscription
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            You&apos;ll be signed out on every device right away, and won&apos;t be able to log back in. Nothing
            is deleted, so if you change your mind, email support and we&apos;ll turn it back on.
          </p>
          <p className="text-sm text-red-900">
            Looking for a refund instead? Use <span className="font-medium">Feedback &amp; Support</span> below
            with the Billing or refund category and we&apos;ll follow up directly.
          </p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="danger" disabled={submitting} onClick={handleCancel}>
              {submitting ? "Canceling…" : "Yes, cancel my subscription"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-gray-600 hover:underline"
            >
              Never mind
            </button>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </SettingsSection>
  );
}
