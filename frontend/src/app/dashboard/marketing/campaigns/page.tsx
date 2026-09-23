"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Lock, Megaphone, MousePointerClick, Plus, QrCode, Sparkles, Target, Users } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { MarketingTabs } from "@/components/MarketingTabs";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { CampaignChart } from "@/components/marketing/CampaignChart";

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
    <Card className="rounded-2xl p-8 text-center shadow-sm">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
        <Lock className="h-5 w-5" strokeWidth={2} />
      </span>
      <p className="mt-3 font-semibold text-gray-900">Campaigns are a Plus feature</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-gray-500">
        Track shareable links and QR codes for your promotions, and capture leads automatically when people click
        or scan — see who a campaign actually brought in, and whether it was worth what you spent.
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
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">New campaign</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]"
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

  const totalLeads = campaigns?.reduce((sum, c) => sum + c.lead_count, 0) ?? 0;
  const totalClicks = campaigns?.reduce((sum, c) => sum + c.click_count + c.qr_scan_count, 0) ?? 0;
  const avgConversion =
    campaigns && campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + c.conversion_rate, 0) / campaigns.length
      : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Marketing"
        description="Reach your clients with e-blasts, and track promotions with campaigns."
      />
      <MarketingTabs />

      {!isPlus ? (
        <UpgradePrompt />
      ) : (
        <>
          {campaigns && campaigns.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={Sparkles} label="Campaigns" value={campaigns.length} />
                <StatCard icon={MousePointerClick} label="Clicks + scans" value={totalClicks} tone="neutral" />
                <StatCard icon={Users} label="Leads" value={totalLeads} />
                <StatCard icon={Target} label="Avg. conversion" value={`${avgConversion.toFixed(1)}%`} tone="neutral" />
              </div>
              <CampaignChart campaigns={campaigns} />
            </>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Campaigns</h2>
            <Button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
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
            <Card className="rounded-2xl p-10 text-center shadow-sm">
              <QrCode className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-gray-600">
                No campaigns yet — create one above to get a shareable link and QR code.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/marketing/campaigns/${c.id}`}
                  className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>${c.cost} spent</span>
                      <ChevronRight
                        className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={2}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <MousePointerClick className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
                      {c.click_count} clicks
                    </span>
                    <span className="flex items-center gap-1">
                      <QrCode className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
                      {c.qr_scan_count} scans
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
                      {c.lead_count} leads
                    </span>
                    <span className="rounded-full bg-[var(--accent-50,#ecfdf5)] px-2 py-0.5 text-xs font-medium text-[var(--accent-700,#047857)]">
                      {c.conversion_rate}% conversion
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
