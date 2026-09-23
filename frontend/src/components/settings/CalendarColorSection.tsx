"use client";

import { useState } from "react";
import { Paintbrush } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, ErrorText } from "@/components/form";
import { ACCENT_PRESETS, type AccentPresetId } from "@/lib/themePresets";
import { SettingsSection } from "./SettingsSection";
import { TabbedPresetPicker } from "./TabbedPresetPicker";

// ----------------------------------------------------------------------------
// Calendar Color — same preset system as Settings > Theme's Software
// Color (see themePresets.ts), applied instead to every colored area of
// the Calendar widget: appointment blocks, the today/selected-day
// highlight, and the Day/Week/Month toggle (see helpers.ts,
// MonthView/WeekView/DayView.tsx, and Calendar.tsx for where each of
// those actually reads --cal-*).
//
// No Show stays a fixed red on purpose, regardless of what's picked here
// — it's a warning state, and letting it get reassigned away from red
// would defeat the point of it standing out on the calendar.
//
// The little preview below the picker exists so there's no guessing —
// see the actual appointment-block look and the today-highlight look
// before saving, not just a swatch color in isolation.
// ----------------------------------------------------------------------------

const ACCENT_OPTIONS = Object.values(ACCENT_PRESETS).map((p) => ({ id: p.id, label: p.label, css: p.bg, kind: p.kind }));

export function CalendarColorSection() {
  const { account, refreshAccount } = useAuth();
  const [accent, setAccent] = useState<AccentPresetId>(account?.calendar_accent ?? "emerald");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preview = ACCENT_PRESETS[accent];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/me/", { method: "PATCH", body: { calendar_accent: accent } });
      await refreshAccount();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection
      icon={Paintbrush}
      title="Calendar Color"
      description={
        <>
          Colors appointments, the today highlight, and the Day/Week/Month toggle on the Calendar. No Show stays red
          no matter what&apos;s picked here, so it always stands out.
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TabbedPresetPicker
          options={ACCENT_OPTIONS}
          kinds={["solid", "gradient"]}
          value={accent}
          onChange={(id) => setAccent(id as AccentPresetId)}
        />

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Preview</p>
          <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <div
              className="w-28 rounded-lg border px-2 py-1.5 text-left text-xs text-white shadow-sm"
              style={{ background: preview.bg, borderColor: preview.shades[700] }}
            >
              <p className="truncate font-medium">Jane Doe</p>
              <p className="truncate" style={{ color: preview.shades[50] }}>
                2:00 PM · 60 min
              </p>
            </div>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium text-white"
              style={{ background: preview.bg }}
            >
              21
            </span>
            <span className="rounded px-3 py-1 text-sm text-white" style={{ background: preview.bg }}>
              Month
            </span>
          </div>
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
