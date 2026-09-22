"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button, Card, Field } from "@/components/form";
import { CreateInvoiceModal } from "@/components/invoicing/CreateInvoiceModal";

// Two reports in one page now: the original Profit & Loss view, and (per
// Mako) what used to be its own "Invoices" nav tab — seeing every
// invoice all together is itself a kind of report, so it lives here
// instead of as a separate top-level section, filterable by paid vs.
// has-a-balance and by date range same as P&L is.

type ProfitLoss = {
  start: string;
  end: string;
  revenue: number;
  refunds: number;
  net: number;
  tax_collected: number;
};

type Client = { id: number; full_name: string };
type Invoice = {
  id: number;
  invoice_number: string;
  client: number;
  status: "unpaid" | "paid" | "refunded" | "quote" | "void";
  issued_date: string;
};

type Product = {
  id: number;
  name: string;
  price: string;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  is_low_stock: boolean;
};

const STATUS_STYLES: Record<Invoice["status"], string> = {
  paid: "bg-emerald-100 text-emerald-700",
  refunded: "bg-amber-100 text-amber-700",
  unpaid: "bg-gray-100 text-gray-700",
  quote: "bg-blue-100 text-blue-700",
  void: "bg-gray-200 text-gray-500",
};

// Default the date range to "start of this year through today" — a
// sensible default for a tax-filing-oriented report, so the page shows
// something useful the moment it loads instead of an empty form.
const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

type Tab = "profit-loss" | "invoices" | "inventory";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("profit-loss");

  const [start, setStart] = useState(startOfYear);
  const [end, setEnd] = useState(today);
  const [pnl, setPnl] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<"" | "paid" | "unpaid" | "void">("");
  const [invoiceStart, setInvoiceStart] = useState("");
  const [invoiceEnd, setInvoiceEnd] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editStock, setEditStock] = useState("");
  const [editThreshold, setEditThreshold] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    // Run the report once automatically on page load (using the default
    // date range above), so there's something on screen right away.
    loadReport();
    apiFetch<Client[]>("/api/clients/").then(setClients);
    loadInvoices();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadProducts() {
    apiFetch<Product[]>("/api/products/").then(setProducts);
  }

  function startEditingProduct(product: Product) {
    setEditingProductId(product.id);
    setEditStock(product.stock_quantity === null ? "" : String(product.stock_quantity));
    setEditThreshold(product.low_stock_threshold === null ? "" : String(product.low_stock_threshold));
  }

  async function handleSaveProduct(productId: number) {
    setSavingProduct(true);
    try {
      await apiFetch(`/api/products/${productId}/`, {
        method: "PATCH",
        body: {
          stock_quantity: editStock === "" ? null : Number(editStock),
          low_stock_threshold: editThreshold === "" ? null : Number(editThreshold),
        },
      });
      setEditingProductId(null);
      loadProducts();
    } finally {
      setSavingProduct(false);
    }
  }

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

  function loadInvoices(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (invoiceStatus) params.set("status", invoiceStatus);
    if (invoiceStart) params.set("start", invoiceStart);
    if (invoiceEnd) params.set("end", invoiceEnd);
    apiFetch<Invoice[]>(`/api/invoicing/invoices/?${params.toString()}`).then(setInvoices);
  }

  function clientName(id: number) {
    return clients.find((c) => c.id === id)?.full_name ?? `#${id}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("profit-loss")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "profit-loss"
              ? "border-b-2 border-[var(--accent-600,#059669)] text-[var(--accent-700,#047857)]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Profit &amp; Loss
        </button>
        <button
          onClick={() => setTab("invoices")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "invoices"
              ? "border-b-2 border-[var(--accent-600,#059669)] text-[var(--accent-700,#047857)]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setTab("inventory")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "inventory"
              ? "border-b-2 border-[var(--accent-600,#059669)] text-[var(--accent-700,#047857)]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Inventory
        </button>
      </div>

      {tab === "profit-loss" && (
        <div className="max-w-lg space-y-6">
          <p className="text-sm text-gray-500">
            Built for tax filing purposes, not tax advice. Consult a professional for filing.
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
      )}

      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Card className="flex-1 p-4">
              <form onSubmit={loadInvoices} className="flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  Status
                  <select
                    value={invoiceStatus}
                    onChange={(e) => setInvoiceStatus(e.target.value as "" | "paid" | "unpaid" | "void")}
                    className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">All</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Has a balance</option>
                    {/* Every invoice locks automatically a day after it's created — "Void" is what most invoices end up as, not an edge case. */}
                    <option value="void">Void</option>
                  </select>
                </label>
                <Field label="From" type="date" value={invoiceStart} onChange={(e) => setInvoiceStart(e.target.value)} />
                <Field label="To" type="date" value={invoiceEnd} onChange={(e) => setInvoiceEnd(e.target.value)} />
                <Button type="submit">Filter</Button>
              </form>
            </Card>
            <Button className="ml-3" onClick={() => setShowCreateModal(true)} disabled={clients.length === 0}>
              Create invoice
            </Button>
          </div>

          {clients.length === 0 && (
            <Card className="p-4 text-sm text-gray-600">
              Add at least one <Link href="/dashboard/clients" className="text-emerald-700 underline">client</Link>{" "}
              before creating an invoice.
            </Card>
          )}

          {invoices === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : invoices.length === 0 ? (
            <Card className="p-6 text-sm text-gray-600">No invoices match these filters.</Card>
          ) : (
            <Card className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>
                    {invoice.status}
                  </span>
                </Link>
              ))}
            </Card>
          )}

          {showCreateModal && (
            <CreateInvoiceModal
              onClose={() => {
                setShowCreateModal(false);
                loadInvoices();
              }}
            />
          )}
        </div>
      )}

      {tab === "inventory" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Every product you&apos;re tracking stock for, in one place. Adjust counts or warning
            thresholds here without having to go find each one on the Products page.
          </p>

          {products === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : products.length === 0 ? (
            <Card className="p-6 text-sm text-gray-600">
              No products yet. Add some from the{" "}
              <Link href="/dashboard/products" className="text-emerald-700 underline">
                Products
              </Link>{" "}
              page.
            </Card>
          ) : (
            <Card className="divide-y divide-gray-200">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-500">${product.price}</p>
                  </div>

                  {editingProductId === product.id ? (
                    <div className="flex items-end gap-3">
                      <label className="text-sm">
                        In stock
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editStock}
                          onChange={(e) => setEditStock(e.target.value)}
                          className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-sm">
                        Warn at
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editThreshold}
                          onChange={(e) => setEditThreshold(e.target.value)}
                          className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <Button onClick={() => handleSaveProduct(product.id)} disabled={savingProduct}>
                        {savingProduct ? "Saving…" : "Save"}
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingProductId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      {product.stock_quantity !== null ? (
                        <p className={`text-sm ${product.is_low_stock ? "font-medium text-red-600" : "text-gray-600"}`}>
                          {product.is_low_stock && "⚠ "}
                          {product.stock_quantity} in stock
                          {product.low_stock_threshold !== null && ` · warns at ${product.low_stock_threshold}`}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">Not tracked</p>
                      )}
                      <button
                        onClick={() => startEditingProduct(product)}
                        className="text-sm text-emerald-700 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
