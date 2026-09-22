"use client";

import { useState } from "react";

import { PresetSwatchPicker, type SwatchOption } from "./PresetSwatchPicker";
import type { PresetKind } from "@/lib/themePresets";

// ----------------------------------------------------------------------------
// Wraps PresetSwatchPicker with Solid / Gradient / Design sub-tabs, so a
// picker with a lot of options (Background has 14) doesn't turn into one
// giant wall of swatches — pick the kind of look you want first, then
// choose from just that handful. Reused by every color picker in
// Settings (Theme's Background/Navigation/Buttons, Calendar's Calendar
// Color) with whichever `kinds` actually apply to that surface — Design
// only makes sense for Background, so Navigation/Buttons/Calendar just
// pass ["solid", "gradient"] and never show that tab.
// ----------------------------------------------------------------------------

const KIND_LABELS: Record<PresetKind, string> = {
  solid: "Solid Colors",
  gradient: "Gradient Colors",
  design: "Design",
};

export function TabbedPresetPicker({
  options,
  kinds,
  value,
  onChange,
}: {
  options: (SwatchOption & { kind: PresetKind })[];
  kinds: PresetKind[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selectedKind = options.find((o) => o.id === value)?.kind ?? kinds[0];
  const [activeKind, setActiveKind] = useState<PresetKind>(selectedKind);

  return (
    <div>
      <div className="flex gap-1 rounded-md bg-gray-100 p-1 text-sm">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setActiveKind(kind)}
            className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
              activeKind === kind ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {KIND_LABELS[kind]}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <PresetSwatchPicker options={options.filter((o) => o.kind === activeKind)} value={value} onChange={onChange} />
      </div>
    </div>
  );
}
