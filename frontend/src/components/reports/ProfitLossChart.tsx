"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Visual breakdown of the P&L numbers already listed below it — revenue
// in, cost of goods out, what's left as gross profit and net. Bar
// height makes the relative size of each figure obvious at a glance in
// a way four lines of "$X" text next to each other can't. Cost of
// goods (money leaving) gets a distinct rose tone rather than sharing
// the account's accent color family the earned figures use, so the
// chart itself hints at which bars are "in" vs. "out" before you even
// read the numbers.
// ----------------------------------------------------------------------------

type ProfitLoss = {
  revenue: number;
  cogs: number;
  gross_profit: number;
  net: number;
};

export function ProfitLossChart({ pnl }: { pnl: ProfitLoss }) {
  const data = [
    { name: "Revenue", value: pnl.revenue, color: "var(--accent-500, #10b981)" },
    { name: "Cost of goods", value: pnl.cogs, color: "#fb7185" },
    { name: "Gross profit", value: pnl.gross_profit, color: "var(--accent-600, #059669)" },
    { name: "Net", value: pnl.net, color: "var(--accent-700, #047857)" },
  ];

  if (data.every((d) => d.value === 0)) {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Revenue breakdown</h2>
        <div className="mt-6 flex h-32 items-center justify-center text-sm text-gray-400">
          No paid invoices in this date range yet.
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Revenue breakdown</h2>
      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
              contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
