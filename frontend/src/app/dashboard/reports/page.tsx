"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button, Card, Field } from "@/components/form";

// The Profit & Loss report page — lets a business pick a date range and
// see revenue/refunds/net/tax for that window. All the actual number-
// crunching happens on the backend (reports/views.py's ProfitLossView);
// this page just collects the date range and displays what comes back.

type ProfitLoss = {
  start: string;
  end: string;
  revenue: number;
  refunds: number;
  net: number;
  tax_collected: number;
};

// Default the date range to "start of this year through today" — a
// sensible default for a tax-filing-oriented report, so the page shows
// something useful the moment it loads instead of an empty form.
const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [start, setStart] = useState(startOfYear);
  const [end, setEnd] = useState(today);
  const [pnl, setPnl] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Run the report once automatically on page load (using the default
    // date range above), so there's something on screen right away.
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `e?: React.FormEvent` — the `?` makes this optional, since this same
  // function gets called two ways: from the form's onSubmit (which DOES
  // pass an event) and from the useEffect above (which doesn't).
  async function loadReport(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch<ProfitLoss>(
        `/api/reports/profit-loss/?start=${start}&end=${end}`
      );
      setPnl(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">Profit &amp; Loss</h1>
      <p className="text-sm text-gray-500">
        Built for tax filing purposes — not tax advice. Consult a professional for filing.
      </p>

      <Card className="p-4">
        <form onSubmit={loadReport} className="flex items-end gap-3">
          <Field label="Start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Field label="End" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Button type="submit" disabled={loading}>
            {loading ? "Loading…" : "Run report"}
          </Button>
        </form>
      </Card>

      {pnl && (
        <Card className="divide-y divide-gray-200 p-4 text-sm">
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Revenue</span>
            <span>${pnl.revenue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Refunds</span>
            <span>-${pnl.refunds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 font-medium">
            <span>Net</span>
            <span>${pnl.net.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 text-gray-500">
            <span>Tax collected</span>
            <span>${pnl.tax_collected.toFixed(2)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
