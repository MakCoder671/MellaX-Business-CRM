"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Lowest-stock-first so the products closest to running out draw the
// eye, not whatever happens to be alphabetically or ID-first — a stock
// report should surface risk, not sort order. Low-stock bars get a
// warning red so they read as distinct from healthy stock before you
// even read the number, matching the red used for the low-stock text
// in the list below.
// ----------------------------------------------------------------------------

type Product = {
  id: number;
  name: string;
  stock_quantity: number | null;
  is_low_stock: boolean;
};

export function StockLevelsChart({ products }: { products: Product[] }) {
  const data = products
    .filter((p) => p.stock_quantity !== null)
    .sort((a, b) => (a.stock_quantity ?? 0) - (b.stock_quantity ?? 0))
    .slice(0, 8)
    .map((p) => ({ name: p.name, stock: p.stock_quantity ?? 0, low: p.is_low_stock }))
    .reverse();

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Stock levels</h2>
        <div className="mt-6 flex h-32 items-center justify-center text-sm text-gray-400">
          No products with tracked stock yet.
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Stock levels</h2>
      <p className="text-xs text-gray-400">Lowest stock first</p>
      <div className="mt-4" style={{ height: Math.max(data.length * 36, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#f1f5f9" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 12, fill: "#374151" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => `${Number(value)} in stock`}
              contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="stock" radius={[0, 6, 6, 0]} maxBarSize={20}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.low ? "#ef4444" : "var(--accent-500, #10b981)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
