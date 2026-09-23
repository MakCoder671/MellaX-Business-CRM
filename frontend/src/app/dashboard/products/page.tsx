"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <Button onClick={() => (showForm ? closeForm() : startAdding())}>{showForm ? "Cancel" : "Add product"}</Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-3">
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
            <div className="col-span-3 flex items-center gap-3">
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
        <Card className="p-6 text-sm text-gray-600">
          You don&apos;t have any products yet. Add your first one above.
        </Card>
      ) : (
        <Card className="divide-y divide-gray-200">
          {products.map((product) => (
            <div key={product.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{product.name}</p>
                  {product.description && <p className="text-sm text-gray-500">{product.description}</p>}
                  {product.stock_quantity !== null && (
                    <p className={`mt-1 text-xs font-medium ${product.is_low_stock ? "text-red-600" : "text-gray-500"}`}>
                      {product.is_low_stock && "⚠ "}
                      {product.stock_quantity} in stock
                      {product.low_stock_threshold !== null && ` · warns at ${product.low_stock_threshold}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    ${product.price}
                    {product.cost !== null && <span className="text-gray-400"> · costs ${product.cost}</span>}
                  </span>
                  <button
                    onClick={() => {
                      setOrderingId(orderingId === product.id ? null : product.id);
                      setOrderAmount("");
                    }}
                    className="text-sm text-emerald-700 hover:underline"
                  >
                    Order more
                  </button>
                  <button onClick={() => startEditing(product)} className="text-sm text-emerald-700 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(product)} className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              </div>

              {orderingId === product.id && (
                <div className="mt-3 flex items-end gap-3 rounded-md bg-gray-50 p-3">
                  <label className="text-sm">
                    How many did you just order?
                    <input
                      type="number"
                      min="1"
                      step="1"
                      autoFocus
                      value={orderAmount}
                      onChange={(e) => setOrderAmount(e.target.value)}
                      className="mt-1 block w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <p className="pb-2 text-xs text-gray-500">
                    Currently {product.stock_quantity ?? 0} in stock, will become{" "}
                    {(product.stock_quantity ?? 0) + (Number(orderAmount) || 0)}.
                  </p>
                  <Button type="button" onClick={() => handleConfirmOrder(product)} disabled={ordering || !orderAmount}>
                    {ordering ? "Adding…" : "Add to stock"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setOrderingId(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
