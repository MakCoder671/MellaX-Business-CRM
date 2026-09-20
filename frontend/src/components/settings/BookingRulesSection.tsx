"use client";

import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText } from "@/components/form";

// ----------------------------------------------------------------------------
// Two calendar-behavior preferences that don't fit neatly under Operating
// Hours (which is just "when are we open"):
//
//   - Allow double booking: off by default, and actually enforced by the
//     backend (see scheduling/serializers.py's AppointmentSerializer) —
//     not just a cosmetic toggle. Off means a new or edited appointment
//     that overlaps an existing one on the same calendar gets rejected;
//     on means overlaps are allowed.
//   - Default calendar view: which of Day/Week/Month the dashboard
//     Calendar widget opens to. Purely a starting point — the toggle on
//     the widget itself still switches freely between all three any time.
// ----------------------------------------------------------------------------

const VIEW_OPTIONS: { value: "day" | "week" | "month"; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export function BookingRulesSection() {
  const { account, refreshAccount } = useAuth();
  const [allowDoubleBooking, setAllowDoubleBooking] = useState(account?.allow_double_booking ?? false);
  const [defaultView, setDefaultView] = useState(account?.default_calendar_view ?? "month");
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
        body: { allow_double_booking: allowDoubleBooking, default_calendar_view: defaultView },
      });
      await refreshAccount();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium">Booking Rules</h2>
      <p className="mt-1 text-sm text-gray-500">How the Calendar behaves when scheduling appointments.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={allowDoubleBooking}
            onChange={(e) => setAllowDoubleBooking(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-gray-700">Allow double booking</span>
            <span className="block text-sm text-gray-500">
              <span className="font-semibold">Off</span>: a new appointment can&apos;t overlap one that&apos;s
              already scheduled, it has to land in a fully open spot.{" "}
              <span className="font-semibold">On</span>: clients can be booked on the same day and at the same
              time.
            </span>
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Default calendar view
          <p className="mb-2 mt-0.5 text-sm font-normal text-gray-500">
            Which view the Calendar opens to. You can always switch to the others from the toggle on the
            widget itself.
          </p>
          <div className="flex gap-2">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDefaultView(option.value)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  defaultView === option.value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}
