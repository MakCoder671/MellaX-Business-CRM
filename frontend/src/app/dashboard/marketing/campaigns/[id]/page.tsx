"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Download, MousePointerClick, QrCode, Target, Users } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Card } from "@/components/form";
import { StatCard } from "@/components/StatCard";
import { LeadStatusChart } from "@/components/marketing/LeadStatusChart";

// ----------------------------------------------------------------------------
// One campaign's full picture: the shareable link and QR code to hand
// out, the click/scan/lead numbers, and the actual list of leads it
// brought in (with a way to mark each one contacted/converted as you
// follow up). This is the "Campaign Report" from the plan doc, plus the
// Lead List, on one page since they're always looked at together.
// ----------------------------------------------------------------------------

type Campaign = {
  id: number;
  name: string;
  cost: string;
  details: string;
  share_link: string;
  qr_code_image: string;
  click_count: number;
  qr_scan_count: number;
  lead_count: number;
  conversion_rate: number;
};

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string;
  interested_in: string;
  message: string;
  status: "new" | "contacted" | "converted";
  created_at: string;
};

const STATUS_STYLES: Record<Lead["status"], string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-amber-100 text-amber-700",
  converted: "bg-emerald-100 text-emerald-700",
};

export default function CampaignDetailPage({
  params,
}: PageProps<"/dashboard/marketing/campaigns/[id]">) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    apiFetch<Campaign>(`/api/campaigns/campaigns/${id}/`).then(setCampaign);
    apiFetch<Lead[]>(`/api/campaigns/leads/?campaign=${id}`).then(setLeads);
  }

  useEffect(load, [id]);

  async function copyLink() {
    if (!campaign) return;
    try {
      await navigator.clipboard.writeText(campaign.share_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (older browsers, permissions) — the
      // link is still shown as plain text right below the button either
      // way, so there's always a fallback to copy it manually.
    }
  }

  async function updateLeadStatus(lead: Lead, status: Lead["status"]) {
    await apiFetch(`/api/campaigns/leads/${lead.id}/`, { method: "PATCH", body: { status } });
    load();
  }

  if (!campaign) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/marketing/campaigns"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-700,#047857)] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          All campaigns
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{campaign.name}</h1>
        {campaign.details && <p className="text-sm text-gray-500">{campaign.details}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard icon={MousePointerClick} label="Clicks" value={campaign.click_count} tone="neutral" />
        <StatCard icon={QrCode} label="QR scans" value={campaign.qr_scan_count} tone="neutral" />
        <StatCard icon={Users} label="Leads" value={campaign.lead_count} />
        <StatCard icon={Target} label="Conversion" value={`${campaign.conversion_rate}%`} />
        <StatCard icon={MousePointerClick} label="Cost" value={`$${campaign.cost}`} tone="neutral" />
      </div>

      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Share this campaign</h2>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={campaign.qr_code_image}
              alt={`QR code for ${campaign.name}`}
              className="h-32 w-32 rounded-xl border border-gray-200"
            />
            <a
              href={campaign.qr_code_image}
              download
              className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-[var(--accent-700,#047857)] hover:underline"
            >
              <Download className="h-3 w-3" strokeWidth={2.5} />
              Download QR code
            </a>
          </div>
          <div className="flex-1">
            <p className="text-sm leading-relaxed text-gray-500">
              The link covers online sharing (bio links, posts); the QR code covers in-person marketing (flyers, a
              booth, a business card).
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={campaign.share_link}
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
              />
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[var(--accent-600,#059669)]" strokeWidth={2.5} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Leads</h2>
          {leads === null ? (
            <p className="mt-2 text-sm text-gray-500">Loading…</p>
          ) : leads.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No leads yet. They&apos;ll show up here as soon as someone fills out the form.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {leads.map((lead) => (
                <li key={lead.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead, e.target.value as Lead["status"])}
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[lead.status]}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                    </select>
                  </div>
                  <p className="text-sm text-gray-500">{[lead.email, lead.phone].filter(Boolean).join(" · ")}</p>
                  {lead.interested_in && (
                    <p className="text-sm text-gray-500">Interested in: {lead.interested_in}</p>
                  )}
                  {lead.message && <p className="mt-1 text-sm text-gray-700">{lead.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <LeadStatusChart leads={leads ?? []} />
      </div>
    </div>
  );
}
