"use client";

import { useEffect, useState } from "react";
import { Receipt, X } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText } from "@/components/form";

import { InvoiceView } from "./InvoiceView";

// ----------------------------------------------------------------------------
// The whole "Checkout" flow lives here — a self-contained popup instead of
// navigating to a list of invoices, per Mako: seeing every OTHER invoice
// (already paid ones included) while you're just trying to bill THIS
// client was confusing. Opened from an appointment's Checkout button and
// from the client profile's Appointments tab, always for a specific,
// already-known client — so there's no client picker here, just their
// name and info shown for confirmation.
//
// Prices are locked (straight from the Service, never hand-typed) — the
// only way to change what a LINE costs is a one-off amount + $/% typed
// in right there (not a saved Discount — that's what the invoice-wide
// discount below is for). The totals block mirrors the exact math
// invoicing/models.py's Invoice methods do on the backend, live-updating
// as you build the invoice AND as you type into the payment fields, so
// there's never a need to do that math by hand.
//
// Split payments (cash + card, say) are their own little list here — an
// amount gets "Saved" into the list, the fields clear for the next one,
// and the button at the bottom reads "No Payment" when that list is
// still empty or "Finalize Invoice" once it isn't. "Quote" skips payment
// entirely and saves it as a non-binding quote instead of a real bill.
//
// Once saved, this same popup swaps its content for InvoiceView — the
// realistic, paper-style invoice with its own action rail — instead of
// navigating anywhere, so "Finalize Invoice" ends with something to
// actually look at, print, or email right then.
// ----------------------------------------------------------------------------

type Client = { id: number; full_name: string; email: string; phone: string };
type Service = { id: number; name: string; price: string; is_taxable: boolean; is_product: boolean };
type Discount = { id: number; name: string; type: "flat" | "percent"; amount: string };
type TenderType = { id: number; name: string };

type LineItemDraft = {
  service: number | "";
  quantity: string;
  discountType: "flat" | "percent";
  discountValue: string;
};

type PaymentDraft = { tenderTypeId: number; amount: string };

function lineDiscountAmount(item: LineItemDraft, services: Service[]) {
  const service = services.find((s) => s.id === item.service);
  const value = Number(item.discountValue || 0);
  if (!service || !value) return 0;
  const gross = Number(item.quantity || 0) * Number(service.price);
  return item.discountType === "flat" ? Math.min(value, gross) : gross * (value / 100);
}

function lineNet(item: LineItemDraft, services: Service[]) {
  const service = services.find((s) => s.id === item.service);
  if (!service) return 0;
  const gross = Number(item.quantity || 0) * Number(service.price);
  return gross - lineDiscountAmount(item, services);
}

// Renders a negative balance as "-$20.00" instead of the awkward "$-20.00".
function money(amount: number) {
  return amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : `$${amount.toFixed(2)}`;
}

export function CreateInvoiceModal({
  clientId,
  appointmentId,
  initialServiceId,
  onClose,
  onSaved,
}: {
  // Locked (no picker shown) when this invoice is being created FROM a
  // specific client — Checkout on the calendar, or the client profile's
  // Appointments tab. Left undefined when opened generically (Reports'
  // Invoices tab), which shows a normal client dropdown instead — same
  // form either way, so there's only ever one "create an invoice"
  // experience in the app.
  clientId?: number;
  appointmentId?: number;
  initialServiceId?: number | null;
  // Fires once, the moment the invoice (and any payments) are actually
  // saved — before the popup switches to showing it. For side effects
  // like flipping an appointment to "completed" on checkout.
  onSaved?: (invoiceId: number) => void;
  // The one "I'm fully done with this" signal — fired whether someone
  // bails out of the create form early, or closes the invoice view
  // afterward. Callers use it to refresh their own data and hide the popup.
  onClose: () => void;
}) {
  const { account } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | "">(clientId ?? "");
  const [services, setServices] = useState<Service[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [tenderTypes, setTenderTypes] = useState<TenderType[]>([]);

  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { service: initialServiceId ?? "", quantity: "1", discountType: "flat", discountValue: "" },
  ]);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [tenderTypeId, setTenderTypeId] = useState<number | "">("");
  const [amount, setAmount] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"quote" | "save" | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<Client[]>("/api/clients/").then(setClients);
    // Products are just services with stock tracking on top (see
    // services/models.py) - the backend already accepts either as a line
    // item, so both lists get combined into one picker here.
    Promise.all([apiFetch<Service[]>("/api/services/"), apiFetch<Service[]>("/api/products/")]).then(
      ([svc, products]) => setServices([...svc, ...products])
    );
    apiFetch<Discount[]>("/api/invoicing/discounts/").then(setDiscounts);
    apiFetch<TenderType[]>("/api/invoicing/tender-types/").then(setTenderTypes);
  }, []);

  const client = clients.find((c) => c.id === selectedClientId) ?? null;

  function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    setLineItems((items) => [...items, { service: "", quantity: "1", discountType: "flat", discountValue: "" }]);
  }

  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  function addPayment() {
    if (tenderTypeId === "" || !amount.trim()) return;
    setPayments((p) => [...p, { tenderTypeId, amount }]);
    setTenderTypeId("");
    setAmount("");
  }

  function removePayment(index: number) {
    setPayments((p) => p.filter((_, i) => i !== index));
  }

  // Live preview of the total — mirrors invoicing/models.py's Invoice
  // methods exactly (net per line -> tax on the net amounts -> the
  // invoice-wide discount applied to the subtotal+tax) so what's shown
  // here never drifts from what the backend actually saves.
  const taxPercent = Number(account?.service_tax_percent ?? 0);
  const subtotal = lineItems.reduce((sum, item) => sum + lineNet(item, services), 0);
  const tax = lineItems.reduce((sum, item) => {
    const service = services.find((s) => s.id === item.service);
    return service?.is_taxable ? sum + lineNet(item, services) * (taxPercent / 100) : sum;
  }, 0);
  const preDiscountTotal = subtotal + tax;
  const selectedInvoiceDiscount = discounts.find((d) => d.id === invoiceDiscount);
  const invoiceDiscountAmount = selectedInvoiceDiscount
    ? selectedInvoiceDiscount.type === "flat"
      ? Math.min(Number(selectedInvoiceDiscount.amount), preDiscountTotal)
      : preDiscountTotal * (Number(selectedInvoiceDiscount.amount) / 100)
    : 0;
  const total = preDiscountTotal - invoiceDiscountAmount;

  // Live paid/balance — per Mako, this reacts to the Amount field as
  // it's typed into, not just to payments already added to the list
  // below, so there's never a need to do the math by hand. Negative
  // balance = overpaid.
  const savedPaymentsTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingAmount = Number(amount || 0);
  const livePaid = savedPaymentsTotal + pendingAmount;
  const liveBalance = total - livePaid;

  const hasPayment = payments.length > 0;

  async function handleSave(status: "quote" | "unpaid") {
    setError(null);
    if (selectedClientId === "") {
      setError("Select a client.");
      return;
    }
    const validItems = lineItems.filter((item) => item.service !== "");
    if (validItems.length === 0) {
      setError("Add at least one line item.");
      return;
    }

    setSaving(status === "quote" ? "quote" : "save");
    try {
      const invoice = await apiFetch<{ id: number }>("/api/invoicing/invoices/", {
        method: "POST",
        body: {
          client: selectedClientId,
          appointment: appointmentId ?? null,
          discount: invoiceDiscount || null,
          notes,
          status,
          line_items: validItems.map((item) => ({
            service: item.service,
            quantity: item.quantity,
            discount_type: item.discountType,
            discount_value: item.discountValue || null,
          })),
        },
      });

      if (status === "unpaid" && hasPayment) {
        // Sequential, not parallel — each payment can flip the
        // invoice's status (paid/refunded), so they need to land in
        // order rather than racing each other.
        for (const payment of payments) {
          await apiFetch("/api/invoicing/payments/", {
            method: "POST",
            body: {
              client: selectedClientId,
              invoice: invoice.id,
              tender_type: payment.tenderTypeId,
              amount: payment.amount,
              is_refund: false,
            },
          });
        }
      }

      onSaved?.(invoice.id);
      setCreatedInvoiceId(invoice.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(null);
    }
  }

  if (createdInvoiceId !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-8 backdrop-blur-sm">
        <Card className="max-h-full w-full max-w-4xl overflow-hidden rounded-2xl p-0 shadow-2xl">
          <InvoiceView invoiceId={createdInvoiceId} onClose={onClose} />
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-8 backdrop-blur-sm">
      <Card className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl p-0 shadow-2xl">
        {/* Header - a small brand-tinted icon badge instead of a bare
            heading, matching the invoice document's own letterhead feel. */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="accent-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Receipt className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              {clientId ? (
                <h2 className="text-base font-semibold text-gray-900">
                  New invoice for {client?.full_name ?? "…"}
                </h2>
              ) : (
                <label className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  New invoice for
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : "")}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm font-medium"
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
              )}
              <p className="text-sm text-gray-500">
                {client ? client.email || client.phone || "No contact info on file" : "Line items lock in the service's actual price"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Line items</p>
          {lineItems.map((item, i) => {
            const service = services.find((s) => s.id === item.service);
            return (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <label className="flex-1 text-sm">
                  Item
                  <select
                    value={item.service}
                    onChange={(e) => updateLineItem(i, { service: e.target.value ? Number(e.target.value) : "" })}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Select</option>
                    {/* Split into Services / Products so it's obvious at a glance which is which,
                        instead of one flat list mixing things that draw down stock with things that don't. */}
                    {services.some((s) => !s.is_product) && (
                      <optgroup label="Services">
                        {services
                          .filter((s) => !s.is_product)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {services.some((s) => s.is_product) && (
                      <optgroup label="Products">
                        {services
                          .filter((s) => s.is_product)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                <label className="w-20 text-sm">
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="w-20 text-sm">
                  Price
                  {/* Locked — this is always the service's actual price,
                      never something typed by hand. The only way to
                      change what a line costs is the discount fields
                      next to it. */}
                  <p className="mt-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 font-medium text-gray-700">
                    {service ? `$${Number(service.price).toFixed(2)}` : "—"}
                  </p>
                </div>
                <label className="w-20 text-sm">
                  Discount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={item.discountValue}
                    onChange={(e) => updateLineItem(i, { discountValue: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
                  <button
                    type="button"
                    onClick={() => updateLineItem(i, { discountType: "flat" })}
                    title="Dollar amount off"
                    className={`px-2 py-1.5 ${item.discountType === "flat" ? "accent-bg" : "bg-white text-gray-600"}`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLineItem(i, { discountType: "percent" })}
                    title="Percent off"
                    className={`px-2 py-1.5 ${item.discountType === "percent" ? "accent-bg" : "bg-white text-gray-600"}`}
                  >
                    %
                  </button>
                </div>
                {/* Live, so typing "15" meaning "15% off" without
                    noticing the $ button is still selected shows up
                    immediately as "-$15.00 off" instead of only being
                    discovered once the final total looks wrong. */}
                {!!item.discountValue && (
                  <span className="text-xs font-medium text-emerald-700">
                    = -${lineDiscountAmount(item, services).toFixed(2)} off
                  </span>
                )}
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(i)}
                    className="mb-1.5 text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" onClick={addLineItem} className="text-sm font-medium text-emerald-700 hover:underline">
            + Add another line item
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Discount (applies to the whole invoice)
            <select
              value={invoiceDiscount}
              onChange={(e) => setInvoiceDiscount(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">None</option>
              {discounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        {/* Totals — a receipt-style card rather than bare rows, so the
            number someone's about to charge stands out from everything
            else being configured above it. */}
        <div className="mt-6 ml-auto w-64 space-y-1.5 rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          {invoiceDiscount !== "" && (
            <div className="flex justify-between text-gray-500">
              <span>Discount</span>
              <span>-${invoiceDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          {/* Live — reacts to the payment fields below as they're typed
              into, so there's never a need to do the math by hand. */}
          <div className="flex justify-between text-gray-500">
            <span>Total paid</span>
            <span>{money(livePaid)}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-white px-2 py-1.5 font-semibold text-gray-900 shadow-sm">
            <span>Balance due</span>
            <span className={liveBalance < 0 ? "text-red-600" : ""}>{money(liveBalance)}</span>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700">Record a payment (optional)</p>
          <p className="mt-1 text-xs text-gray-500">
            Leave this blank to save the invoice with an open balance and collect payment later. Split across more
            than one tender type (cash + card, say) by saving each one separately.
          </p>

          {payments.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {payments.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-gray-700">
                    {tenderTypes.find((t) => t.id === p.tenderTypeId)?.name ?? "Payment"}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">${Number(p.amount).toFixed(2)}</span>
                    <button type="button" onClick={() => removePayment(i)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-[140px] flex-1 text-sm">
              Tender type
              <select
                value={tenderTypeId}
                onChange={(e) => setTenderTypeId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Select</option>
                {tenderTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-32 text-sm">
              Amount
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <Button type="button" variant="secondary" onClick={addPayment} disabled={tenderTypeId === "" || !amount.trim()}>
              Save
            </Button>
          </div>
        </div>
        </div>

        {/* Footer — pinned outside the scrollable body so the primary
            action is always reachable, even on a long invoice. */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
          <ErrorText>{error}</ErrorText>
          <Button type="button" variant="secondary" onClick={() => handleSave("quote")} disabled={saving !== null}>
            {saving === "quote" ? "Saving…" : "Quote"}
          </Button>
          <Button type="button" onClick={() => handleSave("unpaid")} disabled={saving !== null}>
            {saving === "save" ? "Saving…" : hasPayment ? "Finalize Invoice" : "No Payment"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
