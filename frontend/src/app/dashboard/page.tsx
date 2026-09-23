"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, UserPlus, Users } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/form";
import { GettingStarted } from "@/components/GettingStarted";
import { Calendar } from "@/components/calendar/Calendar";

// The dashboard "home" page — /dashboard exactly, not /dashboard/clients
// etc. Just a quick at-a-glance summary: how many clients, and this
// year's revenue/net from the P&L report endpoint. Also where
// <GettingStarted /> lives — the setup checklist popup that replaces the
// old forced onboarding wizard (see components/GettingStarted.tsx).

type ProfitLoss = { revenue: number; refunds: number; net: number; tax_collected: number };

// A quick "Good morning/afternoon/evening" instead of a flat, static
// greeting — costs nothing (just reads the visitor's own clock) but
// makes the page feel like it's actually looking back at you.
function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Shared look for the three stat tiles below — an icon in a small
// accent-tinted badge, a label, and the number. Written once so
// Clients/Revenue/Net can't drift out of sync with each other visually.
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-100,#d1fae5)] text-[var(--accent-700,#047857)]"
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
    </Card>
  );
}

export default function DashboardOverviewPage() {
  const { account } = useAuth();
  const [clientCount, setClientCount] = useState<number | null>(null); // null = "still loading," not "zero clients"
  const [pnl, setPnl] = useState<ProfitLoss | null>(null);

  useEffect(() => {
    // Two independent API calls, fired off at the same time (neither
    // depends on the other's result) — much faster than awaiting them
    // one after another.
    apiFetch<unknown[]>("/api/clients/").then((clients) => setClientCount(clients.length));
    apiFetch<ProfitLoss>("/api/reports/profit-loss/").then(setPnl);
  }, []);

  return (
    <div className="space-y-6">
      {/* Renders as a small text link once dismissed, or pops open as a
          modal automatically for a fresh account — see the component
          itself for the logic behind which one shows. */}
      <GettingStarted />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {timeOfDayGreeting()}, {account?.business_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here&apos;s how your business is doing.
        </p>
      </div>

      {clientCount === 0 ? (
        // Per the plan doc's "empty states with guidance" rule — a brand
        // new account with nothing in it yet gets a helpful nudge instead
        // of just... blank stat cards showing zeroes everywhere.
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-100,#d1fae5)] text-[var(--accent-700,#047857)]"
            aria-hidden="true"
          >
            <UserPlus className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-gray-600">
            You don&apos;t have any clients yet.{" "}
            <Link href="/dashboard/clients" className="font-medium text-[var(--accent-700,#047857)] underline">
              Add your first one
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Clients" value={clientCount !== null ? String(clientCount) : "…"} />
          <StatCard
            icon={DollarSign}
            label="Revenue (YTD)"
            value={pnl ? `$${pnl.revenue.toFixed(2)}` : "…"}
          />
          <StatCard icon={TrendingUp} label="Net (YTD)" value={pnl ? `$${pnl.net.toFixed(2)}` : "…"} />
        </div>
      )}

      {/* Lives right under the stat boxes on purpose — Operating Hours
          (Settings) is what shapes this view (closed days show as
          "Off"), so keeping it on the same page they're most likely to
          check daily beats burying it behind a separate nav item. */}
      <Calendar />
    </div>
  );
}
