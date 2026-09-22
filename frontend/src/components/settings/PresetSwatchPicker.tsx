"use client";

// ----------------------------------------------------------------------------
// One reusable "pick a pre-made option" grid, shared by every preset
// picker in the app (Settings > Theme's Software Color + Background, and
// Settings > Calendar's Calendar Color) — same look and click-to-select
// behavior everywhere, so it only had to be built once. Each swatch shows
// the actual color/gradient it applies, not just a name, so there's
// nothing to guess before picking one.
// ----------------------------------------------------------------------------

export type SwatchOption = {
  id: string;
  label: string;
  css: string; // whatever goes in the `background` shorthand - a flat hex or a gradient
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
            className={`flex items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              selected ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span
              className="h-8 w-8 shrink-0 rounded-full border border-black/10"
              style={{ background: option.css }}
            />
            <span className="flex-1 font-medium text-gray-700">{option.label}</span>
            {selected && <span className="text-gray-900">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
