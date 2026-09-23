"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Donut breakdown of a single campaign's leads by status. Colors match
// the status pills used right below it in the lead list (STATUS_STYLES
// in the campaign detail page) rather than the account's theme color —
// unlike clicks/scans/leads, "new vs contacted vs converted" is a fixed
// three-way state machine, not something that should shift with a theme
// change and lose its meaning.
// ----------------------------------------------------------------------------

type Lead = { status: "new" | "contacted" | "converted" };

const STATUS_COLORS: Record<Lead["status"], string> = {
  new: "#9ca3af",
  contacted: "#d97706",
  converted: "#059669",
};

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
};

export function LeadStatusChart({ leads }: { leads: Lead[] }) {
  const counts: Record<Lead["status"], number> = { new: 0, contacted: 0, converted: 0 };
  for (const lead of leads) counts[lead.status]++;
  const data = (Object.keys(counts) as Lead["status"][])
    .filter((status) => counts[status] > 0)
    .map((status) => ({ status, value: counts[status] }));

  if (leads.length === 0) {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Lead status</h2>
        <div className="mt-6 flex h-32 items-center justify-center text-sm text-gray-400">No leads yet.</div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Lead status</h2>
      <div className="mt-2 flex items-center gap-4">
        <div className="h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="status" innerRadius={40} outerRadius={62} paddingAngle={3}>
                {data.map((d) => (
                  <Cell key={d.status} fill={STATUS_COLORS[d.status]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, entry) => [
                  value,
                  STATUS_LABELS[(entry?.payload as { status: Lead["status"] })?.status],
                ]}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5">
          {data.map((d) => (
            <li key={d.status} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
              {STATUS_LABELS[d.status]}
              <span className="font-medium text-gray-900">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
