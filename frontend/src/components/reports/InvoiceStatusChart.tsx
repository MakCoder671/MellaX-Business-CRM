"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Same donut-plus-legend pattern as the marketing dashboard's
// LeadStatusChart. Colors intentionally match the status pills shown on
// each invoice row below (STATUS_STYLES in page.tsx) so the chart and
// the list read as the same visual language instead of two different
// color systems for the same five states. Reflects whatever the
// Invoice History filters are currently set to, same as the list below it.
// ----------------------------------------------------------------------------

type Invoice = { status: "unpaid" | "paid" | "refunded" | "quote" | "void" };

const STATUS_COLORS: Record<Invoice["status"], string> = {
  paid: "#059669",
  unpaid: "#6b7280",
  refunded: "#d97706",
  quote: "#2563eb",
  void: "#9ca3af",
};

const STATUS_LABELS: Record<Invoice["status"], string> = {
  paid: "Paid",
  unpaid: "Has a balance",
  refunded: "Refunded",
  quote: "Quote",
  void: "Void",
};

export function InvoiceStatusChart({ invoices }: { invoices: Invoice[] }) {
  const counts: Record<Invoice["status"], number> = { paid: 0, unpaid: 0, refunded: 0, quote: 0, void: 0 };
  for (const invoice of invoices) counts[invoice.status]++;
  const data = (Object.keys(counts) as Invoice["status"][])
    .filter((status) => counts[status] > 0)
    .map((status) => ({ status, value: counts[status] }));

  if (invoices.length === 0) {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Status breakdown</h2>
        <div className="mt-6 flex h-32 items-center justify-center text-sm text-gray-400">
          No invoices match these filters.
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Status breakdown</h2>
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
                  STATUS_LABELS[(entry?.payload as { status: Invoice["status"] })?.status],
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
