"use client";

import { Field } from "@/components/form";
import { isoDay } from "@/lib/reports";

export type DateRange = { start: string; end: string; label: string };

// The quick ranges every report offers. Each one sets both dates at once, so an
// owner never has to remember which dates to type in.
export function presetRanges(today = new Date()): DateRange[] {
  const year = today.getFullYear();
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };
  return [
    { label: "This year", start: `${year}-01-01`, end: isoDay(today) },
    { label: "Last year", start: `${year - 1}-01-01`, end: `${year - 1}-12-31` },
    { label: "Last 90 days", start: isoDay(daysAgo(90)), end: isoDay(today) },
    { label: "Last 12 months", start: isoDay(daysAgo(365)), end: isoDay(today) },
  ];
}

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const presets = presetRanges();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset)}
            aria-pressed={value.label === preset.label}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              value.label === preset.label
                ? "accent-bg border-transparent"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <Field
        label="From"
        type="date"
        value={value.start}
        onChange={(e) => onChange({ start: e.target.value, end: value.end, label: "Custom" })}
      />
      <Field
        label="To"
        type="date"
        value={value.end}
        onChange={(e) => onChange({ start: value.start, end: e.target.value, label: "Custom" })}
      />
    </div>
  );
}
