"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// ----------------------------------------------------------------------------
// Operating Hours — one row per weekday. Per the plan doc, this "reflects
// directly on the Calendar" (days/times outside these show as "Off"
// there) — this Settings section is the ONE place that gets configured,
// not something maintained twice.
//
// This talks to a slightly unusual backend endpoint — scheduling/views.py's
// BusinessHoursView isn't a normal list/create/update ViewSet, because
// there's always exactly 7 rows (one per day), never more or fewer. GET
// returns all 7 (creating sane defaults the first time), PUT replaces all 7 at once.
// ----------------------------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Matches scheduling/models.py's BusinessHours.DAY_CHOICES, where Monday=0 ... Sunday=6.
// We reorder DAY_NAMES for display (index 0 = Sunday) but the day_of_week
// VALUES sent to the backend still use Monday=0, so dayLabel() below maps
// between the two.
function dayLabel(dayOfWeek: number) {
  // dayOfWeek: 0=Monday ... 6=Sunday. Shift it so Sunday becomes index 0,
  // matching how most people read a week starting Sun-Sat.
  return DAY_NAMES[(dayOfWeek + 1) % 7];
}

type BusinessHour = {
  id: number;
  day_of_week: number;
  open_time: string | null; // "HH:MM:SS" format, or null if closed
  close_time: string | null;
  is_open: boolean;
};

export function OperatingHoursSection() {
  const [hours, setHours] = useState<BusinessHour[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<BusinessHour[]>("/api/scheduling/business-hours/").then((fetched) => {
      // The time inputs below show "09:00"/"17:00" as a fallback for a
      // day that's open but has no times set yet — but that fallback
      // only lived in the JSX before, never in this component's actual
      // state. That meant clicking Save without touching a single time
      // field sent `null` times to the backend while the screen looked
      // like it had real hours on it. Filling the real defaults in here,
      // right after loading, means what's on screen always matches what
      // Save will actually send.
      setHours(
        fetched.map((day) =>
          day.is_open
            ? { ...day, open_time: day.open_time ?? "09:00:00", close_time: day.close_time ?? "17:00:00" }
            : day
        )
      );
    });
  }, []);

  function updateDay(dayOfWeek: number, patch: Partial<BusinessHour>) {
    setHours((current) =>
      current
        ? current.map((h) => (h.day_of_week === dayOfWeek ? { ...h, ...patch } : h))
        : current
    );
  }

  async function handleSave() {
    if (!hours) return;
    setSubmitting(true);
    setSaved(false);
    try {
      await apiFetch("/api/scheduling/business-hours/", { method: "PUT", body: hours });
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection
      icon={Clock}
      title="Operating Hours"
      description={<>Days/times outside these show as &quot;Off&quot; on your Calendar.</>}
    >
      {!hours ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-2">
          {/* Sort a copy for display (Sunday first) without touching the
              actual order of the `hours` array itself — day_of_week is
              what matters, not array position. */}
          {[...hours]
            .sort((a, b) => ((a.day_of_week + 1) % 7) - ((b.day_of_week + 1) % 7))
            .map((day) => (
              <div
                key={day.day_of_week}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-sm"
              >
                <label className="flex w-32 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.is_open}
                    onChange={(e) =>
                      updateDay(day.day_of_week, {
                        is_open: e.target.checked,
                        // Same fallback as when first loading (see the
                        // useEffect above) — flipping a day open should
                        // never leave it with null times either.
                        open_time: e.target.checked ? day.open_time ?? "09:00:00" : day.open_time,
                        close_time: e.target.checked ? day.close_time ?? "17:00:00" : day.close_time,
                      })
                    }
                  />
                  {dayLabel(day.day_of_week)}
                </label>
                {day.is_open ? (
                  <>
                    <input
                      type="time"
                      value={day.open_time?.slice(0, 5) ?? "09:00"}
                      onChange={(e) => updateDay(day.day_of_week, { open_time: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={day.close_time?.slice(0, 5) ?? "17:00"}
                      onChange={(e) => updateDay(day.day_of_week, { close_time: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1"
                    />
                  </>
                ) : (
                  <span className="text-gray-400">Closed</span>
                )}
              </div>
            ))}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
            {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
