"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/form";

// ----------------------------------------------------------------------------
// A clean, letterhead-style view of one invoice — the "can be emailed,
// downloaded, or printed" part of the Basic Plan's invoicing workflow
// that didn't have an actual page yet. Uses the browser's own print
// dialog (window.print()) rather than generating a PDF server-side —
// "save as PDF" is one of the built-in destinations in that dialog on
// every major browser, so it covers "download" too without us needing
// a PDF-generation library for v1.
//
// This is also where Branding actually shows up on an invoice: the
// account's logo (Settings > Branding) renders right in the letterhead,
// pulled from the same useAuth() data every other page already has —
// nothing invoice-specific to configure.
// ----------------------------------------------------------------------------

type LineItem = {
  id: number;
  service: number;
  quantity: string;
  unit_price: string;
  is_refund_line: boolean;
  net_amount: number;
};

type Payment = {
  id: number;
  amount: string;
  is_refund: boolean;
};

type Invoice = {
  id: number;
  invoice_number: string;
  client: number;
  status: "unpaid" | "paid" | "refunded" | "quote" | "void";
  issued_date: string;
  notes: string;
  tax_amount: string;
  subtotal: number;
  discount_amount: number;
  total_due: number;
  discount: number | null;
  line_items: LineItem[];
  payment_records: Payment[];
};

type Client = { id: number; full_name: string; email: string; phone: string };
type Service = { id: number; name: string };

export default function PrintInvoicePage({ params }: PageProps<"/dashboard/invoices/[id]/print">) {
  const { id } = use(params);
  const { account } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    apiFetch<Invoice>(`/api/invoicing/invoices/${id}/`).then((inv) => {
      setInvoice(inv);
      apiFetch<Client>(`/api/clients/${inv.client}/`).then(setClient);
    });
    // A line item can point at either a service or a product (see
    // services/models.py) - both lists get combined here so either one's
    // name resolves correctly.
    Promise.all([apiFetch<Service[]>("/api/services/"), apiFetch<Service[]>("/api/products/")]).then(
      ([svc, products]) => setServices([...svc, ...products])
    );
  }, [id]);

  function serviceName(serviceId: number) {
    return services.find((s) => s.id === serviceId)?.name ?? `Item #${serviceId}`;
  }

  if (!invoice || !client || !account) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const isQuote = invoice.status === "quote";
  const paid = invoice.payment_records.reduce(
    (sum, p) => sum + (p.is_refund ? -Number(p.amount) : Number(p.amount)),
    0
  );
  const balanceDue = invoice.total_due - paid;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between p-4 print:hidden">
        <Link href={`/dashboard/invoices/${invoice.id}`} className="text-sm text-emerald-700 underline">
          ← Back
        </Link>
        <Button onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>

      {/* The actual printable document — this is the part `window.print()`
          captures, and the only part still visible once dashboard/layout.tsx's
          print:hidden sidebar/header disappear from the print output. */}
      <div className="border border-gray-200 bg-white p-4 sm:p-10 print:border-0 print:p-0">
        <div className="flex items-start justify-between">
          <div>
            {account.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.logo} alt="" className="mb-3 h-14 w-14 rounded object-cover" />
            )}
            <p className="text-lg font-semibold text-gray-900">{account.business_name}</p>
            {account.address && <p className="text-sm text-gray-500">{account.address}</p>}
            {account.phone && <p className="text-sm text-gray-500">{account.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-gray-900">{isQuote ? "Quote" : "Invoice"}</p>
            <p className="mt-1 text-sm text-gray-500">{invoice.invoice_number}</p>
            <p className="text-sm text-gray-500">{invoice.issued_date}</p>
            <p className="mt-2 text-sm font-medium uppercase text-gray-700">{invoice.status}</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Bill to</p>
          <p className="mt-1 font-medium text-gray-900">{client.full_name}</p>
          {client.email && <p className="text-sm text-gray-500">{client.email}</p>}
          {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
        </div>

        {/* overflow-x-auto for the on-screen view (before someone hits
            Print) on a narrow phone — print:overflow-visible so the
            actual printed/PDF output never clips a column instead of
            just letting it flow onto the page normally. */}
        <div className="overflow-x-auto print:overflow-visible">
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit price</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((li) => (
              <tr key={li.id} className="border-b border-gray-100">
                <td className="py-2 text-gray-900">
                  {serviceName(li.service)}
                  {li.is_refund_line && <span className="ml-1 text-amber-600">(refund)</span>}
                </td>
                <td className="py-2 text-right text-gray-600">{li.quantity}</td>
                <td className="py-2 text-right text-gray-600">${Number(li.unit_price).toFixed(2)}</td>
                <td className="py-2 text-right text-gray-900">${li.net_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="ml-auto mt-4 w-48 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>${Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          {invoice.discount && (
            <div className="flex justify-between text-gray-500">
              <span>Discount</span>
              <span>-${invoice.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-900">
            <span>Total</span>
            <span>${invoice.total_due.toFixed(2)}</span>
          </div>
          {!isQuote && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Paid</span>
                <span>${paid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium text-gray-900">
                <span>Balance due</span>
                <span>${balanceDue.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {(invoice.notes || account.default_invoice_terms) && (
          <div className="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-500">
            {invoice.notes && <p>{invoice.notes}</p>}
            {account.default_invoice_terms && <p className="mt-1">{account.default_invoice_terms}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
