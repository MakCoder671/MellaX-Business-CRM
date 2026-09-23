"use client";

import { Check } from "lucide-react";

// ----------------------------------------------------------------------------
// One reusable "pick a pre-made option" grid, shared by every preset
// picker in the app (Settings > Theme's Software Color + Background, and
// Settings > Calendar's Calendar Color) — same look and click-to-select
// behavior everywhere, so it only had to be built once.
//
// Each card shows a real preview tile of what it applies (not a tiny
// color dot next to a name) — for Design backgrounds that's an actual
// crop of the illustrated horizon art, not a guessed gradient stand-in 
// — so there's nothing to imagine before picking one. Selection is a
// small floating check badge over the tile rather than a border/ring
// color, since the picker can't safely borrow a gradient preset's own
// color for its own "you picked me" indicator.
// ----------------------------------------------------------------------------

export type SwatchOption = {
  id: string;
  label: string;
  css: string; // whatever goes in the `background` shorthand - a flat hex, a gradient, or a design's art + gradient
};

export function PresetSwatchPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: SwatchOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            aria-pressed={selected}
            className={`group overflow-hidden rounded-xl border bg-white text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? "border-gray-900 shadow-sm"
                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="relative h-14 w-full overflow-hidden" style={{ background: option.css }}>
              {selected && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 shadow-sm">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="px-2.5 py-2">
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{option.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
