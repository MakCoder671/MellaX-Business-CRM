"use client";

import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// The "Business Information" section of Settings — name, phone, address.
// These feed straight into invoices, the landing page, and documents
// automatically per the plan doc, so getting them right here matters
// even though this looks like the most boring section.
// ----------------------------------------------------------------------------

export function BusinessInfoSection() {
  const { account, refreshAccount } = useAuth();
  // "?? ''" everywhere below: account starts out null for a split second
  // while the app first loads, so these fall back to empty strings
  // instead of crashing on `undefined`.
  const [businessName, setBusinessName] = useState(account?.business_name ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [address, setAddress] = useState(account?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/me/", {
        method: "PATCH",
        body: { business_name: businessName, phone, address },
      });
      await refreshAccount(); // so the sidebar/header (which show account.business_name) update immediately too
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium">Business Information</h2>
      <p className="mt-1 text-sm text-gray-500">
        Feeds into invoices, your landing page, and documents automatically.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field
          label="Business name"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}
