"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button, Card, Field } from "@/components/form";

type ProfitLoss = {
  start: string;
  end: string;
  revenue: number;
  refunds: number;
  net: number;
  tax_collected: number;
};

const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [start, setStart] = useState(startOfYear);
  const [end, setEnd] = useState(today);
  const [pnl, setPnl] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
