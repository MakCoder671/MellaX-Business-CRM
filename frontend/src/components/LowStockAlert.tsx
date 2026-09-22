"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button, Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Checked once whenever the dashboard loads (see dashboard/layout.tsx) —
// if any product is at or below its own warning threshold, this pops up
// listing every one of them at once, each with its own Remind Later
// (pick a duration), Dismiss, and Order actions, so a business doesn't
// have to click through one popup per product if several are low at
// the same time.
// ----------------------------------------------------------------------------

type LowStockProduct = {
  id: number;
  name: string;
  stock_quantity: number;
  low_stock_threshold: number;
};

const SNOOZE_OPTIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 60 * 4, label: "4 hours" },
  { minutes: 60 * 24, label: "1 day" },
  { minutes: 60 * 24 * 3, label: "3 days" },
];

export function LowStockAlert() {
  const router = useRouter();
  const [products, setProducts] = useState<LowStockProduct[] | null>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState<Record<number, number>>({});

  useEffect(() => {
    apiFetch<LowStockProduct[]>("/api/products/low-stock/").then(setProducts);
  }, []);

  function removeFromList(id: number) {
    setProducts((current) => (current ? current.filter((p) => p.id !== id) : current));
  }

  async function handleSnooze(product: LowStockProduct) {
    const minutes = snoozeMinutes[product.id] ?? SNOOZE_OPTIONS[0].minutes;
    await apiFetch(`/api/products/${product.id}/snooze/`, { method: "POST", body: { minutes } });
    removeFromList(product.id);
  }

  async function handleDismiss(product: LowStockProduct) {
    await apiFetch(`/api/products/${product.id}/dismiss/`, { method: "POST" });
    removeFromList(product.id);
  }

  function handleOrder(product: LowStockProduct) {
    removeFromList(product.id);
    router.push(`/dashboard/products?order=${product.id}`);
  }

  if (!products || products.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold">Running low on stock</h2>
        <p className="mt-1 text-sm text-gray-500">
          {products.length === 1 ? "This product is" : "These products are"} at or below the warning count you set.
        </p>

        <ul className="mt-4 space-y-4">
          {products.map((product) => (
            <li key={product.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="font-medium text-gray-900">{product.name}</p>
              <p className="text-sm text-gray-600">
                {product.stock_quantity} in stock, warns at {product.low_stock_threshold}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={snoozeMinutes[product.id] ?? SNOOZE_OPTIONS[0].minutes}
                  onChange={(e) => setSnoozeMinutes((s) => ({ ...s, [product.id]: Number(e.target.value) }))}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {SNOOZE_OPTIONS.map((opt) => (
                    <option key={opt.minutes} value={opt.minutes}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" onClick={() => handleSnooze(product)}>
                  Remind me later
                </Button>
                <Button variant="secondary" onClick={() => handleDismiss(product)}>
                  Dismiss
                </Button>
                <Button onClick={() => handleOrder(product)}>Order</Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
