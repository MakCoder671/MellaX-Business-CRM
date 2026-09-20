"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { MarketingTabs } from "@/components/MarketingTabs";

// ----------------------------------------------------------------------------
// Campaign & Lead Tracking (Plus) — business_plan.MD, Plus Plan section.
// A campaign gets a shareable link and a QR code; both point at a public
// form, and every submission becomes a Lead. This page lists campaigns
// with their at-a-glance stats; the detail page (see [id]/page.tsx)
// shows the QR code, the full lead list, and lets you update lead status.
//
// The backend already blocks Basic-tier accounts from these endpoints
// (see campaigns/views.py's IsPlusOrAbove permission) — this page mirrors
// that on the frontend too, so a Basic account sees a clean upgrade
// prompt instead of a page full of failed requests.
// ----------------------------------------------------------------------------

type Campaign = {
  id: number;
  name: string;
  cost: string;
  details: string;
  share_link: string;
  click_count: number;
  qr_scan_count: number;
  lead_count: number;
  conversion_rate: number;
};

function UpgradePrompt() {
  return (
    <Card className="p-6 text-sm text-gray-600">
      <p className="font-medium text-gray-900">Campaigns are a Plus feature</p>
      <p className="mt-1">
        Track shareable links and QR codes for your promotions, and capture leads
        automatically when people click or scan — see who a campaign actually brought in,
        and whether it was worth what you spent.
      </p>
    </Card>
  );
}

function CreateCampaignForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/campaigns/campaigns/", {
        method: "POST",
        body: { name, cost: cost || "0", details },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Campaign name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="Cost spent (optional)"
          type="number"
          step="0.01"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        <label className="block text-sm font-medium text-gray-700">
          Details
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create campaign"}
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

export default function CampaignsPage() {
  const { account } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isPlus = account?.plan_tier === "plus" || account?.plan_tier === "premium";

  function load() {
    apiFetch<Campaign[]>("/api/campaigns/campaigns/").then(setCampaigns);
  }

  useEffect(() => {
    if (isPlus) load();
  }, [isPlus]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Marketing</h1>
      <MarketingTabs />

      {!isPlus ? (
        <UpgradePrompt />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Campaigns</h2>
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "New campaign"}
            </Button>
          </div>

          {showForm && (
            <CreateCampaignForm
              onDone={() => {
                setShowForm(false);
                load();
              }}
            />
          )}

          {campaigns === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : campaigns.length === 0 ? (
            <Card className="p-6 text-sm text-gray-600">
              No campaigns yet — create one above to get a shareable link and QR code.
            </Card>
          ) : (
            <Card className="divide-y divide-gray-200">
              {campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/marketing/campaigns/${c.id}`}
                  className="block p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{c.name}</p>
                    <span className="text-sm text-gray-500">${c.cost} spent</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {c.click_count} clicks · {c.qr_scan_count} QR scans · {c.lead_count} leads ·{" "}
                    {c.conversion_rate}% conversion
                  </p>
                </Link>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
