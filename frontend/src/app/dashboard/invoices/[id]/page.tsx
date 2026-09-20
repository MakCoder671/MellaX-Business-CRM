"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// The invoice detail page — shows one invoice's full breakdown (line
// items, tax, total, payments so far) and has the "record a payment"
// form. This is where "Create Invoice -> Record Payment -> Invoice
// Finalized" from the core loop actually finishes.
//
// Note: a lot of the math here (line totals, total paid, etc) is done in
// plain JavaScript on the frontend for DISPLAY purposes. The actual
// source-of-truth calculations (tax amount, whether the invoice counts
// as "paid") happen on the backend in invoicing/serializers.py — the
// frontend just re-does simple addition here so numbers update instantly
// without needing a round-trip to the server after every click.
// ----------------------------------------------------------------------------

type LineItem = {
  id: number;
  service: number;
  quantity: string;
  unit_price: string;
  is_refund_line: boolean;
};

type Payment = {
  id: number;
  tender_type: number;
  amount: string;
  date_received: string;
  is_refund: boolean;
};

type Invoice = {
  id: number;
  invoice_number: string;
  client: number;
  status: "unpaid" | "paid" | "refunded";
  issued_date: string;
  notes: string;
  tax_amount: string;
  line_items: LineItem[];
  payment_records: Payment[];
};

type TenderType = { id: number; name: string };
type Service = { id: number; name: string };
type Client = { id: number; full_name: string };

export default function InvoiceDetailPage({ params }: PageProps<"/dashboard/invoices/[id]">) {
  const { id } = use(params); // the invoice's ID, pulled from the URL — e.g. /dashboard/invoices/7 -> id = "7"
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [tenderTypes, setTenderTypes] = useState<TenderType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [amount, setAmount] = useState("");
  const [tenderTypeId, setTenderTypeId] = useState<number | "">("");
  const [isRefund, setIsRefund] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    // Fetch the invoice first, then use its `client` ID to fetch that
    // client's details — a second request chained after the first,
    // since we don't know WHICH client to fetch until we see the invoice.
    apiFetch<Invoice>(`/api/invoicing/invoices/${id}/`).then((inv) => {
      setInvoice(inv);
      apiFetch<Client>(`/api/clients/${inv.client}/`).then(setClient);
    });
  }

  useEffect(() => {
    load();
    apiFetch<TenderType[]>("/api/invoicing/tender-types/").then(setTenderTypes);
    apiFetch<Service[]>("/api/services/").then(setServices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // re-run this whole effect if the URL's invoice id ever changes

  function serviceName(serviceId: number) {
    return services.find((s) => s.id === serviceId)?.name ?? `#${serviceId}`;
  }

  // Plain-JS recalculation of the invoice total, for display — mirrors
  // what Invoice.total_due() computes on the backend (invoicing/models.py).
  const lineTotal =
    invoice?.line_items.reduce((sum, li) => sum + Number(li.quantity) * Number(li.unit_price), 0) ?? 0;
  const total = lineTotal + Number(invoice?.tax_amount ?? 0);
  // Refund payments SUBTRACT from the running "paid" total, regular
  // payments ADD to it — same logic the backend uses to decide when an
  // invoice counts as fully paid.
  const paid =
    invoice?.payment_records.reduce(
      (sum, p) => sum + (p.is_refund ? -Number(p.amount) : Number(p.amount)),
      0
    ) ?? 0;

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice || !client) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/invoicing/payments/", {
        method: "POST",
        body: {
          client: client.id,
          invoice: invoice.id,
          tender_type: tenderTypeId,
          amount,
          is_refund: isRefund,
        },
      });
      // Clear the payment form...
      setAmount("");
      setTenderTypeId("");
      setIsRefund(false);
      // ...and reload the invoice, since the backend may have just
      // flipped its status to "paid" or "refunded" (see
      // invoicing/serializers.py's PaymentRecordSerializer.create()) —
      // we want the UI to reflect that immediately.
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!invoice) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/invoices" className="text-sm text-emerald-700 underline">
          ← All invoices
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{invoice.invoice_number}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              invoice.status === "paid"
                ? "bg-emerald-100 text-emerald-700"
                : invoice.status === "refunded"
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {invoice.status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {client && (
              <Link href={`/dashboard/clients/${client.id}`} className="text-emerald-700 underline">
                {client.full_name}
              </Link>
            )}{" "}
            · {invoice.issued_date}
          </p>
          <Link href={`/dashboard/invoices/${invoice.id}/print`} className="text-sm text-emerald-700 underline">
            Print / Download
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-medium text-gray-700">Line items</h2>
        <ul className="mt-2 divide-y divide-gray-200 text-sm">
          {invoice.line_items.map((li) => (
            <li key={li.id} className="flex justify-between py-2">
              <span>
                {serviceName(li.service)} × {li.quantity}
                {li.is_refund_line && <span className="ml-1 text-amber-600">(refund)</span>}
              </span>
              <span>${(Number(li.quantity) * Number(li.unit_price)).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 space-y-1 border-t border-gray-200 pt-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>${Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Paid</span>
            <span>${paid.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-medium text-gray-700">Payments</h2>
        {invoice.payment_records.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No payments recorded yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200 text-sm">
            {invoice.payment_records.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>
                  {tenderTypes.find((t) => t.id === p.tender_type)?.name ?? "Payment"} ·{" "}
                  {p.date_received}
                  {p.is_refund && <span className="ml-1 text-amber-600">(refund)</span>}
                </span>
                <span>${Number(p.amount).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Recording a payment here is a SEPARATE form from the invoice
            itself — matches the backend, where PaymentRecord is its own
            model/endpoint, not a field you edit on the Invoice directly. */}
        <form onSubmit={handleRecordPayment} className="mt-4 space-y-3 border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-700">Record a payment</p>
          <div className="flex gap-3">
            <label className="flex-1 text-sm">
              Tender type
              <select
                required
                value={tenderTypeId}
                onChange={(e) => setTenderTypeId(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="" disabled>
                  Select
                </option>
                {tenderTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-32">
              <Field
                label="Amount"
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isRefund} onChange={(e) => setIsRefund(e.target.checked)} />
            This is a refund
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording…" : "Record payment"}
            </Button>
            <ErrorText>{error}</ErrorText>
          </div>
        </form>
      </Card>
    </div>
  );
}
