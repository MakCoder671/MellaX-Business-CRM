"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Plus, Trash2 } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { isoDay, money } from "@/lib/reports";
import { Button, Card, ErrorText, Field } from "@/components/form";

// The readiness checks for a tax year. Each one says what to fix and what to do,
// so nothing is a surprise when the accountant asks.
export type ReadinessCheck = { key: string; status: "ok" | "warn" | "info"; title: string; detail: string };

export function ReadinessCard({ checks }: { checks: ReadinessCheck[] | null }) {
  if (checks === null) return <p className="text-sm text-gray-500">Checking your records…</p>;
  const open = checks.filter((c) => c.status === "warn").length;
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Ready to file?</h2>
          <p className="text-sm text-gray-500">
            {open === 0
              ? "Nothing needs fixing. Print the tax packet and take it to your tax expert."
              : `${open} thing${open === 1 ? "" : "s"} to fix before you print the packet.`}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {checks.map((check) => (
          <li key={check.key} className="flex items-start gap-3 py-3">
            {check.status === "ok" && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />}
            {check.status === "warn" && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
            {check.status === "info" && <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />}
            <div>
              <p className="text-sm font-medium text-gray-900">{check.title}</p>
              {check.detail && <p className="text-sm text-gray-600">{check.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type OtherIncomeRow = { id: number; date: string; amount: string; description: string };

// Income that isn't an invoice: tips, reimbursements, and similar. It's added to income on line 6.
export function OtherIncomeCard({ year, onChanged }: { year: number; onChanged: () => void }) {
  const [rows, setRows] = useState<OtherIncomeRow[] | null>(null);
  const [date, setDate] = useState(isoDay(new Date()));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<OtherIncomeRow[]>(`/api/reports/other-income/?start=${year}-01-01&end=${year}-12-31`)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load other income.");
      });
    return () => {
      cancelled = true;
    };
  }, [year, reloadKey]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/reports/other-income/", { method: "POST", body: { date, amount, description } });
      setAmount("");
      setDescription("");
      setReloadKey((n) => n + 1);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that. Try again.");
    }
  }

  async function remove(row: OtherIncomeRow) {
    if (!confirm(`Delete “${row.description}” for ${money(row.amount)}?`)) return;
    await apiFetch(`/api/reports/other-income/${row.id}/`, { method: "DELETE" });
    setReloadKey((n) => n + 1);
    onChanged();
  }

  const total = (rows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Other income</h2>
          <p className="text-sm text-gray-500">
            Tips, reimbursements, or other money for the business that didn&apos;t come from an invoice. Added on line 6 of the summary.
          </p>
        </div>
        <p className="text-sm font-semibold text-gray-900">Total {money(total)}</p>
      </div>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <Field label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="Amount ($)" type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field label="What was it?" required value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button type="submit" className="gap-1.5 whitespace-nowrap">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-gray-700">
                {row.date} · {row.description}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-gray-900">{money(row.amount)}</span>
                <button type="button" onClick={() => remove(row)} aria-label="Delete other income" className="text-gray-500 hover:text-rose-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
