"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Horizontal bars (names on the Y axis) rather than vertical — service
// names can run long, and this layout gives them room without
// truncating or rotating labels the way a vertical bar chart would.
// Capped at the top 8 by revenue so one runaway-popular service doesn't
// force ten other razor-thin bars onto the same chart.
// ----------------------------------------------------------------------------

type ItemReportRow = {
  service: number;
  name: string;
  revenue: number;
};

export function ServiceRevenueChart({ rows }: { rows: ItemReportRow[] }) {
  const data = [...rows]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((r) => ({ name: r.name, revenue: r.revenue }))
    .reverse(); // reverse so the highest revenue renders at the top of the chart

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Top services by revenue</h2>
        <div className="mt-6 flex h-32 items-center justify-center text-sm text-gray-400">
          No paid invoices in this date range yet.
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Top services by revenue</h2>
      <div className="mt-4" style={{ height: Math.max(data.length * 36, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 12, fill: "#374151" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => `$${Number(value).toFixed(2)}`}
              contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="revenue" fill="var(--accent-500, #10b981)" radius={[0, 6, 6, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
