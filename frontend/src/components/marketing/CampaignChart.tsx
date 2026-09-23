"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Side-by-side campaign comparison — clicks vs QR scans vs leads, one
// grouped bar per campaign, so it's obvious at a glance which campaign
// is actually pulling its weight instead of scanning a table of numbers
// per campaign. Same theme-color convention as ReachChart: colors come
// from --accent-* CSS variables via inline style rather than Tailwind
// classes, so this chart re-colors itself along with the rest of the
// app when the account picks a different theme in Settings.
// ----------------------------------------------------------------------------

type CampaignPoint = {
  id: number;
  name: string;
  click_count: number;
  qr_scan_count: number;
  lead_count: number;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="max-w-[160px] truncate text-xs font-semibold text-gray-900">{label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((p) => (
          <p key={p.name} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}: <span className="font-medium text-gray-900">{p.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function CampaignChart({ campaigns }: { campaigns: CampaignPoint[] }) {
  if (campaigns.length === 0) return null;

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Campaign performance</h2>
      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={campaigns} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)}
            />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: "#6b7280", paddingTop: 8 }}
            />
            <Bar dataKey="click_count" name="Clicks" fill="var(--accent-300, #6ee7b7)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="qr_scan_count" name="QR scans" fill="var(--accent-500, #10b981)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lead_count" name="Leads" fill="var(--accent-700, #047857)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
