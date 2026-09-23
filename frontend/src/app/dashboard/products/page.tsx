"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, Package, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

// ----------------------------------------------------------------------------
// Same list-form-delete pattern as the Services page — Products really
// are the exact same underlying thing on the backend (see
// services/models.py), just tagged is_product=True and with two extra
// fields: how many are in stock, and the count that should trigger a
// low-stock warning (both optional — leave them blank if you don't want
// to track inventory for a particular product at all).
//
// "Order more" on a row is the quick way to add to stock after
// restocking, without having to do the math of "old count + however
// many just arrived" yourself. It's also where the low-stock popup's
// "Order" button lands (via ?order=<id> in the URL), pre-opened for
// that one product.
// ----------------------------------------------------------------------------

type Product = {
  id: number;
  name: string;
  price: string;
  cost: string | null; // what it costs the business to source/stock this — optional, used for Cost of Goods Sold in Reports
  description: string;
  is_taxable: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  is_low_stock: boolean;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null); // null = the form (when open) is adding a new product; a real id = it's editing that one instead
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // "Order more" — which product's quick-add-to-stock row is open, and
  // how many they're entering.
  const [orderingId, setOrderingId] = useState<number | null>(null);
  const [orderAmount, setOrderAmount] = useState("");
  const [ordering, setOrdering] = useState(false);

  function load() {
    apiFetch<Product[]>("/api/products/").then(setProducts);
  }

  useEffect(() => {
    load();
    // Read straight off window.location instead of the useSearchParams
    // hook — this is a plain one-time read on mount, and avoids that
    // hook's Suspense-boundary requirement for a value we only need once.
    /* eslint-disable react-hooks/set-state-in-effect */
    const orderProductId = new URLSearchParams(window.location.search).get("order");
    if (orderProductId) setOrderingId(Number(orderProductId));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setPrice("");
    setCost("");
    setDescription("");
    setStockQuantity("");
    setLowStockThreshold("");
  }

  function startAdding() {
    closeForm();
    setShowForm(true);
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setPrice(product.price);
    setCost(product.cost ?? "");
    setDescription(product.description);
    setStockQuantity(product.stock_quantity === null ? "" : String(product.stock_quantity));
    setLowStockThreshold(product.low_stock_threshold === null ? "" : String(product.low_stock_threshold));
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        name,
        price,
        cost: cost || null,
        description,
        is_taxable: true,
        stock_quantity: stockQuantity || null,
        low_stock_threshold: lowStockThreshold || null,
      };
      if (editingId === null) {
        await apiFetch("/api/products/", { method: "POST", body });
      } else {
        await apiFetch(`/api/products/${editingId}/`, { method: "PATCH", body });
      }
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    await apiFetch(`/api/products/${product.id}/`, { method: "DELETE" });
    load();
  }

  async function handleConfirmOrder(product: Product) {
    const amount = Number(orderAmount);
    if (!amount || amount <= 0) return;
    setOrdering(true);
    try {
      await apiFetch(`/api/products/${product.id}/`, {
        method: "PATCH",
        body: { stock_quantity: (product.stock_quantity ?? 0) + amount },
      });
      setOrderingId(null);
      setOrderAmount("");
      load();
    } finally {
      setOrdering(false);
    }
  }

  const lowStockCount = products?.filter((p) => p.is_low_stock).length ?? 0;
  const totalStock = products?.reduce((sum, p) => sum + (p.stock_quantity ?? 0), 0) ?? 0;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon={Package}
        title="Products"
        description="Physical items you sell — track stock and get warned before you run out."
        action={
          <Button onClick={() => (showForm ? closeForm() : startAdding())} className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {showForm ? "Cancel" : "Add product"}
          </Button>
        }
      />

      {products && products.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard icon={Package} label="Products" value={products.length} />
          <StatCard icon={Boxes} label="Units in stock" value={totalStock} tone="neutral" />
          <StatCard icon={AlertTriangle} label="Low stock" value={lowStockCount} tone={lowStockCount > 0 ? "warn" : "neutral"} />
        </div>
      )}

      {showForm && (
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{editingId === null ? "New product" : "Edit product"}</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Field
              label="Price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Field
              label="Cost (optional)"
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Field
              label="In stock"
              type="number"
              min="0"
              step="1"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
            />
            <Field
              label="Warn at"
              type="number"
              min="0"
              step="1"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
            <div className="col-span-full flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId === null ? "Save product" : "Save changes"}
              </Button>
              <ErrorText>{error}</ErrorText>
            </div>
          </form>
        </Card>
      )}

      {products === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : products.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center shadow-sm">
          <Package className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-gray-600">You don&apos;t have any products yet. Add your first one above.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const tracksStock = product.stock_quantity !== null;
            // A thin fill bar under the stock count — how full "full"
            // is has no real definition (there's no max_stock field), so
            // it's calibrated against the low-stock threshold instead:
            // 3x the threshold reads as "well stocked", right at the
            // threshold reads as "nearly empty". Products with no
            // threshold set just don't get a bar — there's nothing
            // meaningful to compare the count against.
            const stockRatio =
              tracksStock && product.low_stock_threshold
                ? Math.min(1, (product.stock_quantity ?? 0) / (product.low_stock_threshold * 3))
                : null;

            return (
              <Card
                key={product.id}
                className={`group relative flex flex-col gap-3 rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md ${
                  product.is_low_stock ? "ring-1 ring-red-200" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{product.name}</p>
                    {product.description && (
                      <p className="mt-1 text-sm leading-relaxed text-gray-500">{product.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEditing(product)}
                      aria-label={`Edit ${product.name}`}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      aria-label={`Delete ${product.name}`}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {tracksStock && (
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`flex items-center gap-1 font-medium ${
                          product.is_low_stock ? "text-red-600" : "text-gray-500"
                        }`}
                      >
                        {product.is_low_stock && <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
                        {product.stock_quantity} in stock
                      </span>
                      {product.low_stock_threshold !== null && (
                        <span className="text-gray-400">warns at {product.low_stock_threshold}</span>
                      )}
                    </div>
                    {stockRatio !== null && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${product.is_low_stock ? "bg-red-500" : "accent-bg"}`}
                          style={{ width: `${Math.max(stockRatio * 100, 4)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-lg font-semibold text-gray-900">
                    ${product.price}
                    {product.cost !== null && <span className="ml-1 text-xs font-normal text-gray-400">costs ${product.cost}</span>}
                  </span>
                  <button
                    onClick={() => {
                      setOrderingId(orderingId === product.id ? null : product.id);
                      setOrderAmount("");
                    }}
                    className="flex items-center gap-1 text-sm font-medium text-[var(--accent-700,#047857)] hover:underline"
                  >
                    <PackagePlus className="h-3.5 w-3.5" strokeWidth={2} />
                    Order more
                  </button>
                </div>

                {orderingId === product.id && (
                  <div className="-mx-1 flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
                    <label className="text-sm text-gray-700">
                      How many did you just order?
                      <input
                        type="number"
                        min="1"
                        step="1"
                        autoFocus
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <p className="text-xs text-gray-500">
                      Currently {product.stock_quantity ?? 0} in stock, will become{" "}
                      {(product.stock_quantity ?? 0) + (Number(orderAmount) || 0)}.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => handleConfirmOrder(product)}
                        disabled={ordering || !orderAmount}
                      >
                        {ordering ? "Adding…" : "Add to stock"}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setOrderingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
