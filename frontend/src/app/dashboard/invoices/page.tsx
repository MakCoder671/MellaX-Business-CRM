"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText } from "@/components/form";

// ----------------------------------------------------------------------------
// The most involved page in the app — creating an invoice with a
// variable number of line items (one row per service being billed).
// The tricky bit is `lineItems`: an ARRAY of draft rows that grows/shrinks
// as the user clicks "add another line item" / "remove."
// ----------------------------------------------------------------------------

type Client = { id: number; full_name: string };
type Service = { id: number; name: string; price: string };
type Invoice = {
  id: number;
  invoice_number: string;
  client: number; // just the client's ID here — the full Client object lives in the `clients` list below, looked up by ID when needed
  status: "unpaid" | "paid" | "refunded";
  issued_date: string;
  tax_amount: string;
};

// One row of the "add line items" form, before it's been submitted.
// Quantity/unit_price are kept as strings here because that's what an
// <input type="number"> actually gives you — converted to real numbers
// only when needed for display math.
type LineItemDraft = { service: number | ""; quantity: string; unit_price: string };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState<number | "">("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { service: "", quantity: "1", unit_price: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<Invoice[]>("/api/invoicing/invoices/").then(setInvoices);
  }

  useEffect(() => {
    load();
    // Also grab the full clients & services lists up front — we need
    // them to populate the dropdowns in the "create invoice" form.
    apiFetch<Client[]>("/api/clients/").then(setClients);
    apiFetch<Service[]>("/api/services/").then(setServices);
  }, []);

  // Since the invoice list from the backend only gives us a client ID
  // (not the client's name), this looks the name up from the `clients`
  // list we already fetched — avoids a separate API call per invoice row.
  function clientName(id: number) {
    return clients.find((c) => c.id === id)?.full_name ?? `#${id}`;
  }

  // Updates ONE line item in the array by index, leaving the others
  // untouched — the standard "immutable update" pattern in React: never
  // mutate the array directly, always build a new one.
  function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    setLineItems((items) => [...items, { service: "", quantity: "1", unit_price: "" }]);
  }

  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The backend (invoicing/serializers.py) handles auto-numbering
      // and auto-calculating tax — we only need to send the client and
      // the raw line items here, nothing else.
      await apiFetch("/api/invoicing/invoices/", {
        method: "POST",
        body: {
          client: clientId,
          line_items: lineItems.map((item) => ({
            service: item.service,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        },
      });
      // Reset the form back to one blank line item, close it, and refresh the list.
      setClientId("");
      setLineItems([{ service: "", quantity: "1", unit_price: "" }]);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Button onClick={() => setShowForm((v) => !v)} disabled={clients.length === 0 || services.length === 0}>
          {showForm ? "Cancel" : "Create invoice"}
        </Button>
      </div>

      {(clients.length === 0 || services.length === 0) && (
        <Card className="p-4 text-sm text-gray-600">
          Add at least one <Link href="/dashboard/clients" className="text-emerald-700 underline">client</Link>{" "}
          and one <Link href="/dashboard/services" className="text-emerald-700 underline">service</Link> before
          creating an invoice.
        </Card>
      )}

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Client
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select a client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Line items</p>
              {/* One row per draft line item — the `i` index is what
                  updateLineItem/removeLineItem use to know which row
                  changed. */}
              {lineItems.map((item, i) => (
                <div key={i} className="flex items-end gap-2">
                  <label className="flex-1 text-sm">
                    Service
                    <select
                      required
                      value={item.service}
                      onChange={(e) => {
                        const serviceId = Number(e.target.value);
                        const service = services.find((s) => s.id === serviceId);
                        // Convenience: pre-fill the unit price from the
                        // service's default price when it's picked, but
                        // the price stays editable afterward in case this
                        // particular invoice needs a different amount.
                        updateLineItem(i, {
                          service: serviceId,
                          unit_price: service?.price ?? item.unit_price,
                        });
                      }}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="" disabled>
                        Select
                      </option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-20 text-sm">
                    Qty
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={item.quantity}
                      onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="w-28 text-sm">
                    Unit price
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(i, { unit_price: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      className="mb-1.5 text-sm text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addLineItem} className="text-sm text-emerald-700 underline">
                + Add another line item
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create invoice"}
              </Button>
              <ErrorText>{error}</ErrorText>
            </div>
          </form>
        </Card>
      )}

      {invoices === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : invoices.length === 0 ? (
        <Card className="p-6 text-sm text-gray-600">No invoices yet.</Card>
      ) : (
        <Card className="divide-y divide-gray-200">
          {invoices.map((invoice) => (
            // The whole row is a Link to the invoice detail page — that's
            // where line items, payments, and recording a new payment
            // actually happen (see the [id] folder next to this file).
            <Link
              key={invoice.id}
              href={`/dashboard/invoices/${invoice.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div>
                <p className="font-medium">{invoice.invoice_number}</p>
                <p className="text-sm text-gray-500">
                  {clientName(invoice.client)} · {invoice.issued_date}
                </p>
              </div>
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
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
