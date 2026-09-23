"use client";

import { useState } from "react";
import { Blend, Palette, Image as ImageIcon, type LucideIcon } from "lucide-react";

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
  solid: "Solid",
  gradient: "Gradient",
  design: "Design",
};

const KIND_ICONS: Record<PresetKind, LucideIcon> = {
  solid: Palette,
  gradient: Blend,
  design: ImageIcon,
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
      <div className="inline-flex gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 text-sm">
        {kinds.map((kind) => {
          const Icon = KIND_ICONS[kind];
          const active = activeKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setActiveKind(kind)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
                active ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {KIND_LABELS[kind]}
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <PresetSwatchPicker options={options.filter((o) => o.kind === activeKind)} value={value} onChange={onChange} />
      </div>
    </div>
  );
}
