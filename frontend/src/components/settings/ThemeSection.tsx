"use client";

import { useState } from "react";
import { Palette } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, ErrorText } from "@/components/form";
import { ACCENT_PRESETS, BACKGROUND_PRESETS, type AccentPresetId, type BackgroundPresetId } from "@/lib/themePresets";
import { SettingsSection } from "./SettingsSection";
import { TabbedPresetPicker } from "./TabbedPresetPicker";

// ----------------------------------------------------------------------------
// Two independent things to personalize: Background (the page itself)
// and Buttons (the app's primary-button color, also used for focus rings
// and little "selected" indicators around the app). Both pre-made
// choices only (see themePresets.ts for why), organized into
// Solid / Gradient / Design tabs.
//
// The sidebar isn't its own separate pick any more — per Mako, it should
// just BE the background, not a coordinated-but-different color, so
// dashboard/layout.tsx paints --app-bg once across the whole shell
// (sidebar, header, and content) instead of computing a matching accent
// for the sidebar specifically.
//
// The Calendar's own color lives on the Calendar settings tab instead
// (CalendarColorSection) — same underlying preset system, kept as its
// own separate pick so a business can run a different color there than
// here without the two fighting each other.
// ----------------------------------------------------------------------------

const BUTTON_OPTIONS = Object.values(ACCENT_PRESETS).map((p) => ({ id: p.id, label: p.label, css: p.bg, kind: p.kind }));
const BACKGROUND_OPTIONS = Object.values(BACKGROUND_PRESETS).map((p) => ({
  id: p.id,
  label: p.label,
  css: p.swatch,
  kind: p.kind,
}));

export function ThemeSection() {
  const { account, refreshAccount } = useAuth();
  const [accent, setAccent] = useState<AccentPresetId>(account?.theme_accent ?? "emerald");
  const [background, setBackground] = useState<BackgroundPresetId>(account?.theme_background ?? "default");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/me/", {
        method: "PATCH",
        body: { theme_accent: accent, theme_background: background },
      });
      await refreshAccount(); // also re-applies the CSS variables everywhere, see auth-context.tsx
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection
      icon={Palette}
      title="Theme"
      description="Personalize how the software looks for you. Pick from a set of pre-made looks, no color-blending required."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <p className="text-sm font-medium text-gray-700">Background</p>
          <p className="mb-2 mt-0.5 text-sm text-gray-500">
            The page background, sidebar, and header, one consistent look across the whole dashboard.
          </p>
          <TabbedPresetPicker
            options={BACKGROUND_OPTIONS}
            kinds={["solid", "gradient", "design"]}
            value={background}
            onChange={(id) => setBackground(id as BackgroundPresetId)}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Buttons</p>
          <p className="mb-2 mt-0.5 text-sm text-gray-500">Primary buttons and other accents throughout the app.</p>
          <TabbedPresetPicker
            options={BUTTON_OPTIONS}
            kinds={["solid", "gradient"]}
            value={accent}
            onChange={(id) => setAccent(id as AccentPresetId)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </SettingsSection>
  );
}
