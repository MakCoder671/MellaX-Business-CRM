"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button, Field } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// Discounts — reusable, selectable when building an invoice. Same
// list-plus-add-form shape as Tender Types, just with an extra
// flat-vs-percent choice and an amount.

type Discount = { id: number; name: string; type: "flat" | "percent"; amount: string };

export function DiscountsSection() {
  const [discounts, setDiscounts] = useState<Discount[] | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"flat" | "percent">("percent");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<Discount[]>("/api/invoicing/discounts/").then(setDiscounts);
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/invoicing/discounts/", { method: "POST", body: { name, type, amount } });
      setName("");
      setAmount("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(discount: Discount) {
    if (!confirm(`Remove "${discount.name}"?`)) return;
    await apiFetch(`/api/invoicing/discounts/${discount.id}/`, { method: "DELETE" });
    load();
  }

  return (
    <SettingsSection
      icon={Tag}
      title="Discounts"
      description="Reusable discounts, selectable when building an invoice."
    >
      {discounts && (
        <ul className="divide-y divide-gray-100">
          {discounts.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium text-gray-700">
                {d.name}{" "}
                <span className="font-normal text-gray-400">
                  · {d.type === "percent" ? `${d.amount}%` : `$${d.amount}`}
                </span>
              </span>
              <button onClick={() => handleDelete(d)} className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="text-sm">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "flat" | "percent")}
            className="mt-1 block rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="percent">%</option>
            <option value="flat">$</option>
          </select>
        </label>
        <div className="w-24">
          <Field
            label="Amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          Add
        </Button>
      </form>
    </SettingsSection>
  );
}
