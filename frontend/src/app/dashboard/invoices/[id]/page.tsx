"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

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
type Client = { id: number; name: string };

export default function InvoiceDetailPage({ params }: PageProps<"/dashboard/invoices/[id]">) {
  const { id } = use(params);
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
  }, [id]);

  function serviceName(serviceId: number) {
    return services.find((s) => s.id === serviceId)?.name ?? `#${serviceId}`;
  }

  const lineTotal =
    invoice?.line_items.reduce((sum, li) => sum + Number(li.quantity) * Number(li.unit_price), 0) ?? 0;
  const total = lineTotal + Number(invoice?.tax_amount ?? 0);
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
      setAmount("");
      setTenderTypeId("");
      setIsRefund(false);
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
        <p className="text-sm text-gray-500">
          {client?.name} · {invoice.issued_date}
        </p>
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
