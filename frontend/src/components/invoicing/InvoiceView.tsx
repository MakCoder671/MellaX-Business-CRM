"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText } from "@/components/form";

// ----------------------------------------------------------------------------
// The invoice itself, shared by the standalone /dashboard/invoices/[id]
// page AND shown as a popup right after "Finalize Invoice" in
// CreateInvoiceModal — one component, two wrappers, so the two never
// drift into looking or behaving differently.
//
// By default this is pure read-only paper — a PDF, basically — with
// every action living in the LEFT rail instead. "Edit" is what turns
// the line items and payments into something you can actually change;
// clicking it again ("Done Editing") goes back to the plain read-only
// view. "Record Payment" and "Refund" each open their own small popup
// on top of this one rather than living inline.
//
// Per Mako: nothing about a line item ever actually gets deleted.
// Editing or removing one marks the OLD row voided (crossed out, with a
// required note explaining why) and — for an edit — adds a fresh row
// with the corrected values next to it. Both endpoints live on
// InvoiceViewSet (line-items/, void-line-item/) instead of the old
// "PATCH the whole line_items array" approach, which the backend no
// longer accepts on purpose.
//
// Delete only exists for the first 24 hours after an invoice is
// created — after that, the backend automatically locks it AND flips
// its status to Void on its own (no one has to remember to click
// anything; see Invoice.sync_void_status() and the
// "void_expired_invoices" management command). By the time this
// component ever sees an invoice that old, `status` already says
// "void", so there's no client-side age math here at all — just the
// `locked` check below, driven straight off what the backend sent.
// ----------------------------------------------------------------------------

type LineItem = {
  id: number;
  service: number;
  quantity: string;
  unit_price: string;
  discount_type: "flat" | "percent";
  discount_value: string | null;
  is_refund_line: boolean;
  net_amount: number;
  is_voided: boolean;
  void_note: string;
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
  appointment: number | null;
  discount: number | null;
  status: "unpaid" | "paid" | "refunded" | "quote" | "void";
  issued_date: string;
  created_at: string;
  notes: string;
  tax_amount: string;
  subtotal: number;
  discount_amount: number;
  total_due: number;
  line_items: LineItem[];
  payment_records: Payment[];
};

type TenderType = { id: number; name: string };
type Service = { id: number; name: string; price: string; is_product: boolean };
type Discount = { id: number; name: string; type: "flat" | "percent"; amount: string };
type Client = { id: number; full_name: string; email: string; phone: string };

type LineItemDraft = {
  service: number | "";
  quantity: string;
  discountType: "flat" | "percent";
  discountValue: string;
  reason: string; // only required when revising an existing line — see handleSaveLineItemEdit
};

const EMPTY_DRAFT: LineItemDraft = { service: "", quantity: "1", discountType: "flat", discountValue: "", reason: "" };

const STATUS_STYLES: Record<Invoice["status"], string> = {
  paid: "bg-emerald-100 text-emerald-700",
  refunded: "bg-amber-100 text-amber-700",
  unpaid: "bg-gray-100 text-gray-700",
  quote: "bg-blue-100 text-blue-700",
  void: "bg-gray-200 text-gray-500",
};

// Renders a negative balance as "-$20.00" instead of the awkward "$-20.00"
// that `${n.toFixed(2)}` would give on a negative number.
function money(amount: number) {
  return amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : `$${amount.toFixed(2)}`;
}

// The dollar amount a discount actually knocks off a line — shown next
// to the type/value so "25%" also reads as "(-$50.00)" instead of
// making someone do that math themselves.
function lineDiscountAmount(li: LineItem) {
  if (!li.discount_value) return 0;
  const gross = Number(li.quantity) * Number(li.unit_price);
  return li.discount_type === "percent" ? gross * (Number(li.discount_value) / 100) : Math.min(Number(li.discount_value), gross);
}

function lineDiscountLabel(li: LineItem) {
  if (!li.discount_value) return null;
  const valueLabel = li.discount_type === "percent" ? `${li.discount_value}%` : `$${li.discount_value}`;
  return `${valueLabel} (-$${lineDiscountAmount(li).toFixed(2)})`;
}

// Same idea, but for a not-yet-saved draft row being edited/added — the
// $/% toggle defaults to $ (matching the model's default), so someone
// typing "15" meaning "15% off" without noticing they need to click %
// first would otherwise silently get "$15 off" instead, with no
// feedback until the total comes out wrong. This live preview is what
// catches that before Save, not after.
function draftDiscountAmount(draft: LineItemDraft, services: Service[]) {
  const service = services.find((s) => s.id === draft.service);
  const value = Number(draft.discountValue || 0);
  if (!service || !value) return 0;
  const gross = Number(draft.quantity || 0) * Number(service.price);
  return draft.discountType === "percent" ? gross * (value / 100) : Math.min(value, gross);
}

export function InvoiceView({
  invoiceId,
  onClose,
}: {
  invoiceId: number;
  // Only passed when shown inside a popup (CreateInvoiceModal) — renders
  // a "Close" control and is what Delete/Void fall back to instead of a
  // page navigation. Omitted on the standalone page, which navigates
  // with the router instead.
  onClose?: () => void;
}) {
  const router = useRouter();
  const { account } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [tenderTypes, setTenderTypes] = useState<TenderType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);

  // The read-only PDF view vs. the editable one — toggled from the left rail.
  const [editing, setEditing] = useState(false);

  // Per-row line item editing (only reachable while editing === true) —
  // editingLineItemId, addingLineItem, and removingLineItemId are kept
  // mutually exclusive (starting one cancels whichever of the others
  // was open) so at most one inline form is ever open at a time.
  const [editingLineItemId, setEditingLineItemId] = useState<number | null>(null);
  const [lineItemDraft, setLineItemDraft] = useState<LineItemDraft>(EMPTY_DRAFT);
  const [addingLineItem, setAddingLineItem] = useState(false);
  const [removingLineItemId, setRemovingLineItemId] = useState<number | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  // Per-row payment tender type editing (only reachable while editing === true)
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [paymentTenderDraft, setPaymentTenderDraft] = useState<number | "">("");

  // "Record Payment" popup
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentTenderTypeId, setPaymentTenderTypeId] = useState<number | "">("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // "Refund" popup
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundService, setRefundService] = useState<number | "">("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundTenderTypeId, setRefundTenderTypeId] = useState<number | "">("");
  const [refundNote, setRefundNote] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  function load() {
    apiFetch<Invoice>(`/api/invoicing/invoices/${invoiceId}/`).then((inv) => {
      setInvoice(inv);
      apiFetch<Client>(`/api/clients/${inv.client}/`).then(setClient);
    });
  }

  useEffect(() => {
    load();
    apiFetch<TenderType[]>("/api/invoicing/tender-types/").then(setTenderTypes);
    // Products are just services with stock tracking on top (see
    // services/models.py) - the backend already accepts either as a line
    // item, so both lists get combined into one picker here.
    Promise.all([apiFetch<Service[]>("/api/services/"), apiFetch<Service[]>("/api/products/")]).then(
      ([svc, products]) => setServices([...svc, ...products])
    );
    apiFetch<Discount[]>("/api/invoicing/discounts/").then(setDiscounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  function serviceName(serviceId: number) {
    return services.find((s) => s.id === serviceId)?.name ?? `#${serviceId}`;
  }

  function invoiceDiscountLabel(discountId: number | null) {
    if (discountId === null) return null;
    const d = discounts.find((d) => d.id === discountId);
    if (!d) return null;
    return d.type === "percent" ? `${d.name} (${d.amount}%)` : `${d.name} ($${d.amount})`;
  }

  const locked = invoice?.status === "void";
  const isQuote = invoice?.status === "quote";

  const paid =
    invoice?.payment_records.reduce(
      (sum, p) => sum + (p.is_refund ? -Number(p.amount) : Number(p.amount)),
      0
    ) ?? 0;
  const balanceDue = (invoice?.total_due ?? 0) - paid;

  function startEditingLineItem(li: LineItem) {
    setError(null);
    setAddingLineItem(false);
    setRemovingLineItemId(null);
    setEditingLineItemId(li.id);
    setLineItemDraft({
      service: li.service,
      quantity: li.quantity,
      discountType: li.discount_type,
      discountValue: li.discount_value ?? "",
      reason: "",
    });
  }

  function startRemovingLineItem(li: LineItem) {
    setError(null);
    setEditingLineItemId(null);
    setAddingLineItem(false);
    setRemovingLineItemId(li.id);
    setRemoveReason("");
  }

  async function handleSaveLineItemEdit() {
    if (editingLineItemId === null) return;
    if (!lineItemDraft.reason.trim()) {
      setError("Explain why this line item is being changed.");
      return;
    }
    setError(null);
    try {
      const updated = await apiFetch<Invoice>(`/api/invoicing/invoices/${invoiceId}/line-items/`, {
        method: "POST",
        body: {
          replaces: editingLineItemId,
          note: lineItemDraft.reason,
          service: lineItemDraft.service,
          quantity: lineItemDraft.quantity,
          discount_type: lineItemDraft.discountType,
          discount_value: lineItemDraft.discountValue || null,
        },
      });
      setInvoice(updated);
      setEditingLineItemId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleAddLineItem() {
    setError(null);
    try {
      const updated = await apiFetch<Invoice>(`/api/invoicing/invoices/${invoiceId}/line-items/`, {
        method: "POST",
        body: {
          service: lineItemDraft.service,
          quantity: lineItemDraft.quantity,
          discount_type: lineItemDraft.discountType,
          discount_value: lineItemDraft.discountValue || null,
        },
      });
      setInvoice(updated);
      setAddingLineItem(false);
      setLineItemDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleConfirmRemoveLineItem() {
    if (removingLineItemId === null) return;
    if (!removeReason.trim()) {
      setError("Explain why this line item is being removed.");
      return;
    }
    setError(null);
    try {
      const updated = await apiFetch<Invoice>(`/api/invoicing/invoices/${invoiceId}/void-line-item/`, {
        method: "POST",
        body: { line_item_id: removingLineItemId, note: removeReason },
      });
      setInvoice(updated);
      setRemovingLineItemId(null);
      setRemoveReason("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  function startEditingPayment(p: Payment) {
    setEditingPaymentId(p.id);
    setPaymentTenderDraft(p.tender_type);
  }

  async function handleSavePaymentTenderType(paymentId: number) {
    setError(null);
    try {
      await apiFetch(`/api/invoicing/payments/${paymentId}/`, {
        method: "PATCH",
        body: { tender_type: paymentTenderDraft },
      });
      setEditingPaymentId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setPaymentError(null);
    setSubmittingPayment(true);
    try {
      await apiFetch("/api/invoicing/payments/", {
        method: "POST",
        body: { client: client.id, invoice: invoiceId, tender_type: paymentTenderTypeId, amount: paymentAmount, is_refund: false },
      });
      setPaymentAmount("");
      setPaymentTenderTypeId("");
      setShowPaymentForm(false);
      load();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleSubmitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    if (refundService === "" || !refundAmount.trim() || refundTenderTypeId === "" || !refundNote.trim()) {
      setRefundError("Fill in every field.");
      return;
    }
    setRefundError(null);
    setSubmittingRefund(true);
    try {
      // Two things happen for a refund: a line item crediting the
      // client (so the invoice's own total reflects it), and a payment
      // record showing the actual money that went back out, in
      // whatever tender type it was refunded in. Together they cancel
      // out in the balance due — which is correct, since the refund
      // line already reduced what's owed, and the payment records that
      // real cash actually moved for that reduction.
      await apiFetch(`/api/invoicing/invoices/${invoiceId}/line-items/`, {
        method: "POST",
        body: { service: refundService, quantity: 1, is_refund_line: true, unit_price: refundAmount, note: refundNote },
      });
      await apiFetch("/api/invoicing/payments/", {
        method: "POST",
        body: { client: client.id, invoice: invoiceId, tender_type: refundTenderTypeId, amount: refundAmount, is_refund: true },
      });
      load();
      setShowRefundForm(false);
      setRefundService("");
      setRefundAmount("");
      setRefundTenderTypeId("");
      setRefundNote("");
    } catch (err) {
      setRefundError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmittingRefund(false);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    if (!confirm(`Delete ${invoice.invoice_number}? This can't be undone.`)) return;
    await apiFetch(`/api/invoicing/invoices/${invoice.id}/`, { method: "DELETE" });
    if (onClose) onClose();
    else router.push(`/dashboard/clients/${invoice.client}`);
  }

  async function handleEmail() {
    if (!invoice) return;
    setEmailing(true);
    setStatusMessage(null);
    setError(null);
    try {
      await apiFetch(`/api/invoicing/invoices/${invoice.id}/email/`, { method: "POST" });
      setStatusMessage("Invoice emailed to the client.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setEmailing(false);
    }
  }

  if (!invoice || !client || !account) return <p className="p-6 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="flex flex-col md:flex-row">
      {/* Left action rail — PDF-viewer style, rather than a top toolbar.
          Every adjustment to the invoice happens from here: Edit turns
          the read-only document on the right into something you can
          actually change; Record Payment and Refund each open their own
          small popup on top. */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-gray-200 p-4 md:w-48 md:border-b-0 md:border-r">
        {onClose && (
          <button onClick={onClose} className="mb-2 self-end text-sm text-gray-500 hover:text-gray-700 md:self-start">
            ✕ Close
          </button>
        )}
        {!locked && (
          <Button variant="secondary" className="w-full" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done Editing" : "Edit"}
          </Button>
        )}
        {!locked && !isQuote && (
          <Button variant="secondary" className="w-full" onClick={() => setShowPaymentForm(true)}>
            Record Payment
          </Button>
        )}
        {!locked && !isQuote && (
          <Button variant="secondary" className="w-full" onClick={() => setShowRefundForm(true)}>
            Refund
          </Button>
        )}
        {!locked && (
          <Button variant="danger" className="w-full" onClick={handleDelete}>
            Delete
          </Button>
        )}
        <Link href={`/dashboard/invoices/${invoice.id}/print`} className="w-full">
          <Button variant="secondary" className="w-full">
            Print
          </Button>
        </Link>
        <Button variant="secondary" className="w-full" onClick={handleEmail} disabled={emailing}>
          {emailing ? "Emailing…" : "Email"}
        </Button>
        <Link href={`/dashboard/clients/${client.id}`} className="w-full">
          <Button variant="secondary" className="w-full">
            Go to client profile
          </Button>
        </Link>
        {statusMessage && <p className="text-xs text-emerald-700">{statusMessage}</p>}
        <ErrorText>{error}</ErrorText>
      </div>

      {/* The invoice itself — letterhead, line items, totals, terms.
          Read-only PDF-style unless `editing` is on. */}
      <div className="max-h-[85vh] flex-1 overflow-y-auto p-6">
        {locked && (
          <div className="mb-4 rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
            This invoice has been voided. It&apos;s kept for the record, but nothing on it can be changed anymore.
          </div>
        )}

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
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium uppercase ${STATUS_STYLES[invoice.status]}`}>
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Bill to</p>
          <p className="mt-1 font-medium text-gray-900">{client.full_name}</p>
          {client.email && <p className="text-sm text-gray-500">{client.email}</p>}
          {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Price</th>
              <th className="pb-2 text-right font-medium">Discount</th>
              <th className="pb-2 text-right font-medium">Amount</th>
              {editing && <th className="pb-2"></th>}
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((li) => {
              if (li.is_voided) {
                // Kept, never deleted — shown crossed out with the
                // reason underneath so everyone can see exactly what
                // changed and why.
                return (
                  <Fragment key={li.id}>
                    <tr className="border-b border-gray-50 text-gray-400 line-through">
                      <td className="py-2">
                        {serviceName(li.service)}
                        {li.is_refund_line && <span className="ml-1">(refund)</span>}
                      </td>
                      <td className="py-2 text-right">{li.quantity}</td>
                      <td className="py-2 text-right">${Number(li.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right">{lineDiscountLabel(li) ?? "—"}</td>
                      <td className="py-2 text-right">${li.net_amount.toFixed(2)}</td>
                      {editing && <td className="py-2"></td>}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td colSpan={editing ? 6 : 5} className="pt-0 pb-2 text-xs text-gray-400 italic">
                        {li.void_note}
                      </td>
                    </tr>
                  </Fragment>
                );
              }

              if (editingLineItemId === li.id) {
                return (
                  <tr key={li.id} className="border-b border-gray-100">
                    <td className="py-2" colSpan={6}>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-sm">
                          Item
                          <select
                            value={lineItemDraft.service}
                            onChange={(e) => setLineItemDraft((d) => ({ ...d, service: e.target.value ? Number(e.target.value) : "" }))}
                            className="mt-1 block rounded-md border border-gray-300 px-2 py-1 text-sm"
                          >
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
                            value={lineItemDraft.quantity}
                            onChange={(e) => setLineItemDraft((d) => ({ ...d, quantity: e.target.value }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="w-24 text-sm">
                          Discount
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={lineItemDraft.discountValue}
                            onChange={(e) => setLineItemDraft((d) => ({ ...d, discountValue: e.target.value }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
                          <button
                            type="button"
                            onClick={() => setLineItemDraft((d) => ({ ...d, discountType: "flat" }))}
                            className={`px-2 py-1 ${lineItemDraft.discountType === "flat" ? "bg-emerald-600 text-white" : "bg-white text-gray-600"}`}
                          >
                            $
                          </button>
                          <button
                            type="button"
                            onClick={() => setLineItemDraft((d) => ({ ...d, discountType: "percent" }))}
                            className={`px-2 py-1 ${lineItemDraft.discountType === "percent" ? "bg-emerald-600 text-white" : "bg-white text-gray-600"}`}
                          >
                            %
                          </button>
                        </div>
                        {!!lineItemDraft.discountValue && (
                          <span className="text-xs text-gray-500">
                            = -${draftDiscountAmount(lineItemDraft, services).toFixed(2)} off
                          </span>
                        )}
                        <label className="flex-1 text-sm">
                          Reason for this change
                          <input
                            required
                            value={lineItemDraft.reason}
                            onChange={(e) => setLineItemDraft((d) => ({ ...d, reason: e.target.value }))}
                            placeholder="e.g. Client added two more units"
                            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <Button type="button" onClick={handleSaveLineItemEdit}>
                          Save
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingLineItemId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              if (removingLineItemId === li.id) {
                return (
                  <tr key={li.id} className="border-b border-gray-100 bg-red-50/40">
                    <td className="py-2" colSpan={6}>
                      <div className="flex flex-wrap items-end gap-2">
                        <p className="text-sm text-gray-700">
                          Removing <span className="font-medium">{serviceName(li.service)}</span> (${li.net_amount.toFixed(2)})
                        </p>
                        <label className="flex-1 text-sm">
                          Reason for removing this
                          <input
                            required
                            value={removeReason}
                            onChange={(e) => setRemoveReason(e.target.value)}
                            placeholder="e.g. Client cancelled this service"
                            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <Button type="button" variant="danger" onClick={handleConfirmRemoveLineItem}>
                          Confirm removal
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setRemovingLineItemId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={li.id} className="border-b border-gray-100">
                  <td className="py-2 text-gray-900">
                    {serviceName(li.service)}
                    {li.is_refund_line && <span className="ml-1 text-amber-600">(refund)</span>}
                  </td>
                  <td className="py-2 text-right text-gray-600">{li.quantity}</td>
                  <td className="py-2 text-right text-gray-600">${Number(li.unit_price).toFixed(2)}</td>
                  <td className="py-2 text-right text-gray-500">{lineDiscountLabel(li) ?? "—"}</td>
                  <td className="py-2 text-right text-gray-900">${li.net_amount.toFixed(2)}</td>
                  {editing && (
                    <td className="py-2 text-right text-xs whitespace-nowrap">
                      <button onClick={() => startEditingLineItem(li)} className="text-emerald-700 hover:underline">
                        Edit
                      </button>{" "}
                      {/* "Remove," not "Delete" — the left rail already has a Delete button for the
                          WHOLE invoice, and two same-labeled buttons that close together do very
                          different things was an easy way to click the wrong one. */}
                      <button onClick={() => startRemovingLineItem(li)} className="ml-2 text-red-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {addingLineItem && (
              <tr className="border-b border-gray-100">
                <td className="py-2" colSpan={6}>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      Item
                      <select
                        value={lineItemDraft.service}
                        onChange={(e) => setLineItemDraft((d) => ({ ...d, service: e.target.value ? Number(e.target.value) : "" }))}
                        className="mt-1 block rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="" disabled>
                          Select
                        </option>
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
                        value={lineItemDraft.quantity}
                        onChange={(e) => setLineItemDraft((d) => ({ ...d, quantity: e.target.value }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="w-24 text-sm">
                      Discount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={lineItemDraft.discountValue}
                        onChange={(e) => setLineItemDraft((d) => ({ ...d, discountValue: e.target.value }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
                      <button
                        type="button"
                        onClick={() => setLineItemDraft((d) => ({ ...d, discountType: "flat" }))}
                        className={`px-2 py-1 ${lineItemDraft.discountType === "flat" ? "bg-emerald-600 text-white" : "bg-white text-gray-600"}`}
                      >
                        $
                      </button>
                      <button
                        type="button"
                        onClick={() => setLineItemDraft((d) => ({ ...d, discountType: "percent" }))}
                        className={`px-2 py-1 ${lineItemDraft.discountType === "percent" ? "bg-emerald-600 text-white" : "bg-white text-gray-600"}`}
                      >
                        %
                      </button>
                    </div>
                    {!!lineItemDraft.discountValue && (
                      <span className="text-xs text-gray-500">
                        = -${draftDiscountAmount(lineItemDraft, services).toFixed(2)} off
                      </span>
                    )}
                    <Button type="button" onClick={handleAddLineItem} disabled={lineItemDraft.service === ""}>
                      Add
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setAddingLineItem(false)}>
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {editing && !addingLineItem && editingLineItemId === null && removingLineItemId === null && (
          <button
            onClick={() => {
              setLineItemDraft(EMPTY_DRAFT);
              setAddingLineItem(true);
            }}
            className="mt-2 text-sm text-emerald-700 underline"
          >
            + Add another line item
          </button>
        )}

        <div className="ml-auto mt-4 w-52 space-y-1 text-sm">
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
              <span>Discount{invoiceDiscountLabel(invoice.discount) ? ` (${invoiceDiscountLabel(invoice.discount)})` : ""}</span>
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
                <span>Total paid</span>
                <span>{money(paid)}</span>
              </div>
              <div className="flex justify-between font-medium text-gray-900">
                <span>Balance due</span>
                <span className={balanceDue < 0 ? "text-red-600" : ""}>{money(balanceDue)}</span>
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

        {!isQuote && (
          <div className="mt-8 border-t border-gray-200 pt-4">
            <h2 className="text-sm font-medium text-gray-700">Payments</h2>
            {invoice.payment_records.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No payments recorded yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-200 text-sm">
                {invoice.payment_records.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    {editingPaymentId === p.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <select
                          value={paymentTenderDraft}
                          onChange={(e) => setPaymentTenderDraft(Number(e.target.value))}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                        >
                          {tenderTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => handleSavePaymentTenderType(p.id)} className="text-emerald-700 hover:underline">
                          Save
                        </button>
                        <button onClick={() => setEditingPaymentId(null)} className="text-gray-500 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span>
                        {tenderTypes.find((t) => t.id === p.tender_type)?.name ?? "Payment"} · {p.date_received}
                        {p.is_refund && <span className="ml-1 text-amber-600">(refund)</span>}
                        {editing && (
                          <button onClick={() => startEditingPayment(p)} className="ml-2 text-xs text-emerald-700 hover:underline">
                            Edit tender type
                          </button>
                        )}
                      </span>
                    )}
                    <span>${Number(p.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Record Payment popup */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4">
          <Card className="w-full max-w-sm p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Record a payment</h2>
              <button onClick={() => setShowPaymentForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              <label className="block text-sm">
                Tender type
                <select
                  required
                  value={paymentTenderTypeId}
                  onChange={(e) => setPaymentTenderTypeId(Number(e.target.value))}
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
              <label className="block text-sm">
                Amount
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <p className="text-xs text-gray-500">
                Balance due right now: {money(balanceDue)}
                {paymentAmount && ` · after this payment: ${money(balanceDue - Number(paymentAmount || 0))}`}
              </p>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={submittingPayment}>
                  {submittingPayment ? "Recording…" : "Record payment"}
                </Button>
                <ErrorText>{paymentError}</ErrorText>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Refund popup */}
      {showRefundForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4">
          <Card className="w-full max-w-sm p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Record a refund</h2>
              <button onClick={() => setShowRefundForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Adds a refund line to the invoice and records the money going back out.
            </p>
            <form onSubmit={handleSubmitRefund} className="mt-4 space-y-3">
              <label className="block text-sm">
                Item being refunded
                <select
                  required
                  value={refundService}
                  onChange={(e) => setRefundService(e.target.value ? Number(e.target.value) : "")}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="" disabled>
                    Select
                  </option>
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
              <label className="block text-sm">
                Amount
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-sm">
                Refunded via
                <select
                  required
                  value={refundTenderTypeId}
                  onChange={(e) => setRefundTenderTypeId(e.target.value ? Number(e.target.value) : "")}
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
              <label className="block text-sm">
                Reason
                <input
                  required
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="e.g. Client returned the item"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={submittingRefund}>
                  {submittingRefund ? "Recording…" : "Record refund"}
                </Button>
                <ErrorText>{refundError}</ErrorText>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
