"use client";

import { Field } from "@/components/form";

// The "What it costs you" box on services and products. It explains what belongs
// in the box, and shows the profit per sale as the owner types, so the number
// is never a mystery.
export function CostField({
  value,
  onChange,
  price,
  help,
}: {
  value: string;
  onChange: (value: string) => void;
  price: string;
  help: string;
}) {
  const cost = Number(value);
  const sale = Number(price);
  const showPreview = value !== "" && sale > 0 && cost >= 0;
  return (
    <div className="space-y-2">
      <Field
        label="What it costs you (optional)"
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs leading-relaxed text-gray-500">{help}</p>
      {showPreview && (
        <p className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900">
          You keep about ${(sale - cost).toFixed(2)} of each ${sale.toFixed(2)} sale, before sales tax and your monthly expenses.
        </p>
      )}
    </div>
  );
}
