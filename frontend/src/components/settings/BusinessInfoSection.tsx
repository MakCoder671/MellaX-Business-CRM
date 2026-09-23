"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, ErrorText, Field } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// ----------------------------------------------------------------------------
// The "Business Information" section of Settings — name, phone, address.
// This is the ONE place these get entered: invoices, the public landing
// page, and marketing e-blasts all pull phone/address straight from the
// account (see landingpages/serializers.py's PublicLandingPageSerializer
// and marketing/views.py's e-blast footer) instead of asking for it
// again — update it here and it's updated everywhere it shows up.
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
    <SettingsSection
      icon={Building2}
      title="Business Information"
      description="Feeds into invoices, your landing page, and marketing e-blasts automatically. No need to enter it twice."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
    </SettingsSection>
  );
}
