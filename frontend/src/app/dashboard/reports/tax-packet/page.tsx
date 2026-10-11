"use client";

import { use, useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { money, type TaxQuarters } from "@/lib/reports";
import { ReadinessCard, type ReadinessCheck } from "@/components/reports/TaxExtras";

type Packet = {
  year: number;
  prepared_on: string;
  business: { name: string; address_lines: string[]; state: string };
  summary: { lines: { line: string; label: string; amount: number }[]; notes: string[] };
  expenses: { date: string; category: string; line: string; description: string; vendor: string; amount: string; note: string }[];
  other_income: { date: string; description: string; amount: string }[];
  invoices: { number: string; issued: string; client: string; status: string; total: string }[];
  readiness: ReadinessCheck[];
};

// The printable tax packet. Open it from the tax center, then print it or save it as a PDF.
// Everything on it is labeled, so it can go straight to a tax expert.
export default function TaxPacketPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  const params = use(searchParams);
  const yearParam = Array.isArray(params.year) ? params.year[0] : params.year;
  const year = Number(yearParam ?? new Date().getFullYear());
  const [packet, setPacket] = useState<Packet | null>(null);
  const [quarters, setQuarters] = useState<TaxQuarters | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Packet>(`/api/reports/tax/packet/?year=${year}`),
      apiFetch<TaxQuarters>(`/api/reports/tax/quarters/?year=${year}`),
    ])
      .then(([p, q]) => {
        setPacket(p);
        setQuarters(q);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't build the tax packet."));
  }, [year]);

  if (error) return <p className="p-6 text-sm text-rose-700">{error}</p>;
  if (!packet || !quarters) return <p className="p-6 text-sm text-gray-500">Building your tax packet…</p>;

  const byCategory = packet.expenses.reduce<Record<string, Packet["expenses"]>>((groups, row) => {
    (groups[row.category] ??= []).push(row);
    return groups;
  }, {});
  const expenseTotal = packet.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const incomeTotal = packet.other_income.reduce((sum, i) => sum + Number(i.amount), 0);
  const invoiceTotal = packet.invoices.reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #tax-packet, #tax-packet * { visibility: visible !important; }
          #tax-packet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-4 bg-gray-50 px-6 py-4">
        <p className="text-sm text-gray-600">Your tax packet for {year}. Print it, or choose “Save as PDF” in the print window.</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="accent-bg inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold"
        >
          <Printer className="h-4 w-4" />
          Print or save as PDF
        </button>
      </div>

      <article id="tax-packet" className="mx-auto max-w-4xl space-y-8 bg-white p-8 text-sm text-gray-900">
        <header className="space-y-1 border-b border-gray-300 pb-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">Tax packet</p>
          <h1 className="text-2xl font-semibold">{packet.business.name}</h1>
          <p className="text-gray-700">Tax year {packet.year}</p>
          {packet.business.address_lines.map((line) => (
            <p key={line} className="text-gray-600">
              {line}
            </p>
          ))}
          {packet.business.state && <p className="text-gray-600">State: {packet.business.state}</p>}
          <p className="text-xs text-gray-500">Prepared from MellaX records on {packet.prepared_on}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">1. Ready to file?</h2>
          <ReadinessCard checks={packet.readiness} />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">2. Summary by Schedule C line</h2>
          <table className="w-full text-left">
            <thead className="border-b border-gray-300 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-3">Line</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {packet.summary.lines.map((row) => {
                const bold = ["3", "5", "7", "28", "29", "31"].includes(row.line);
                return (
                  <tr key={`${row.line}-${row.label}`} className={bold ? "font-semibold" : ""}>
                    <td className="py-1.5 pr-3 text-gray-500">{row.line}</td>
                    <td className="py-1.5 pr-3">{row.label}</td>
                    <td className="py-1.5 text-right">{money(row.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
            {packet.summary.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">3. Expenses by category</h2>
          {Object.keys(byCategory).length === 0 && <p className="text-gray-600">No expenses logged for {packet.year}.</p>}
          {Object.entries(byCategory).map(([category, rows]) => (
            <div key={category} className="space-y-1">
              <div className="flex justify-between border-b border-gray-200 pb-1 font-semibold">
                <span>
                  {category} (line {rows[0].line})
                </span>
                <span>{money(rows.reduce((sum, r) => sum + Number(r.amount), 0))}</span>
              </div>
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={`${row.date}-${i}`}>
                      <td className="py-1 pr-3 text-gray-600">{row.date}</td>
                      <td className="py-1 pr-3">{row.description}</td>
                      <td className="py-1 pr-3 text-gray-600">{row.vendor}</td>
                      <td className="py-1 text-right">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="text-right font-semibold">Total expenses {money(expenseTotal)}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">4. Other income (line 6)</h2>
          {packet.other_income.length === 0 ? (
            <p className="text-gray-600">No other income logged for {packet.year}.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-gray-100">
                {packet.other_income.map((row, i) => (
                  <tr key={`${row.date}-${i}`}>
                    <td className="py-1 pr-3 text-gray-600">{row.date}</td>
                    <td className="py-1 pr-3">{row.description}</td>
                    <td className="py-1 text-right">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-right font-semibold">Total other income {money(incomeTotal)}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">5. Sales and sales tax by quarter</h2>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-300 uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-3">Quarter</th>
                <th className="py-2 pr-3 text-right">Invoices</th>
                <th className="py-2 pr-3 text-right">Sales</th>
                <th className="py-2 pr-3 text-right">Taxable</th>
                <th className="py-2 pr-3 text-right">Not taxable</th>
                <th className="py-2 pr-3 text-right">Sales tax collected</th>
                <th className="py-2 text-right">Payments received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quarters.quarters.map((q) => (
                <tr key={q.quarter}>
                  <td className="py-1.5 pr-3">{q.quarter}</td>
                  <td className="py-1.5 pr-3 text-right">{q.invoices}</td>
                  <td className="py-1.5 pr-3 text-right">{money(q.sales)}</td>
                  <td className="py-1.5 pr-3 text-right">{money(q.taxable_sales)}</td>
                  <td className="py-1.5 pr-3 text-right">{money(q.non_taxable_sales)}</td>
                  <td className="py-1.5 pr-3 text-right">{money(q.tax_collected)}</td>
                  <td className="py-1.5 text-right">{money(q.payments_received_ex_tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-600">
            Sales tax collected belongs to the state, so it isn&apos;t part of Schedule C income. Payments are before sales tax.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">6. Invoices issued in {packet.year}</h2>
          {packet.invoices.length === 0 ? (
            <p className="text-gray-600">No invoices issued in {packet.year}.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-300 uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packet.invoices.map((inv) => (
                  <tr key={inv.number}>
                    <td className="py-1 pr-3">{inv.number}</td>
                    <td className="py-1 pr-3">{inv.issued}</td>
                    <td className="py-1 pr-3">{inv.client}</td>
                    <td className="py-1 pr-3">{inv.status}</td>
                    <td className="py-1 text-right">{money(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-right font-semibold">
            {packet.invoices.length} invoice(s), total {money(invoiceTotal)}
          </p>
        </section>

        <footer className="border-t border-gray-300 pt-4 text-xs text-gray-500">
          This packet lists the numbers recorded in MellaX. Your tax expert decides how to file them.
        </footer>
      </article>
    </>
  );
}
