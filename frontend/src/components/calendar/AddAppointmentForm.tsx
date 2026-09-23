"use client";

import { useState } from "react";
import { CalendarPlus, Clock, Repeat, StickyNote, Tag, Timer, User, UserPlus, X } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, ErrorText, Field } from "@/components/form";

import { DURATION_OPTIONS, formatDuration } from "./helpers";
import type { Client, Service } from "./types";

// Shared by DayView, WeekView, and MonthView — one client picker, time
// picker, and duration picker, always for a date the caller already
// knows (the day being viewed, or the day/slot clicked), so there's no
// separate date field here.
//
// Note on `initialTime`: this only ever applies once, on mount — if the
// caller wants to re-seed the time after a fresh slot click (see
// DayView, which does this), it passes `key={addFormTime}` when
// rendering this component so React remounts it with a clean initial
// state, rather than this component reacting to a changed prop after
// the fact. That's the idiomatic React way to "reset state when an
// input changes" instead of a useEffect that calls setState.
//
// Laid out as a booking card: an icon-led header, then fields grouped
// by icon rather than under a "Who & what" / "When & how long" label
// (per Mako, that copy read as awkward filler). On wider screens a
// second column holds a live summary of what's about to be booked —
// client, service, date/time, duration, recurrence — the same "preview
// before you commit" pattern as a checkout summary, which also uses up
// the dead space a single-column form left on a wide card instead of
// just padding it out.
//
// "+ New client" (per Mako, for walk-ins who show up without ever being
// added as a client first): switches the Client field from a dropdown
// to a small inline name/email/phone form, right here instead of
// needing a trip to the Clients page and back. On submit, the client is
// created FIRST, then the appointment is booked for that new client's
// id — one button, one save. onClientAdded lets the caller (ultimately
// useCalendarData) refresh its cached client list, so the new client
// shows up in every OTHER client picker in the app without a page reload.

const FREQUENCY_OPTIONS: { value: "weekly" | "biweekly" | "monthly"; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

type RecurringResult = {
  created: unknown[];
  skipped: { datetime: string; errors: unknown }[];
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]";

function FieldLabel({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
      <Icon className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
      {children}
    </span>
  );
}

export function AddAppointmentForm({
  calendarId,
  clients,
  services,
  date,
  initialTime = "09:00",
  onClientAdded,
  onDone,
}: {
  calendarId: number;
  clients: Client[];
  services: Service[];
  date: Date;
  initialTime?: string; // "HH:MM" — lets DayView's time grid pre-fill the slot someone clicked
  onClientAdded: () => void;
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState<number | "">("");
  const [serviceId, setServiceId] = useState<number | "">(""); // optional — not every quick-added appointment has a service picked yet
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [occurrences, setOccurrences] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The new-client mini-form, shown in place of the Client dropdown when open.
  const [addingClient, setAddingClient] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Same rule as the Clients page's own add-client form (see
    // clients/serializers.py) — checked here too so a walk-in with a
    // blank contact field finds out before the whole appointment submit
    // round-trips, not just this one field.
    if (addingClient && !newEmail && !newPhone) {
      setError("Enter at least an email or a phone number for the new client.");
      return;
    }

    setSubmitting(true);
    try {
      // A brand-new client gets created first — the appointment is then
      // booked against whichever id comes back, new or already-picked.
      let resolvedClientId = clientId;
      if (addingClient) {
        const newClient = await apiFetch<Client>("/api/clients/", {
          method: "POST",
          body: { first_name: newFirstName, last_name: newLastName, email: newEmail, phone: newPhone },
        });
        resolvedClientId = newClient.id;
      }

      const [hours, minutes] = time.split(":").map(Number);
      const localDatetime = new Date(date);
      localDatetime.setHours(hours, minutes, 0, 0);

      const basePayload = {
        calendar: calendarId,
        client: resolvedClientId,
        service: serviceId || null,
        datetime: localDatetime.toISOString(),
        duration_minutes: duration,
        notes,
        status: "scheduled",
        source: "manual",
      };

      if (isRecurring) {
        // Every occurrence gets validated independently on the backend
        // (double-booking included) — a conflicting date is skipped
        // instead of blocking the whole series, so we surface that back
        // here rather than treating a partial success as a failure.
        const result = await apiFetch<RecurringResult>("/api/scheduling/appointments/recurring/", {
          method: "POST",
          body: { ...basePayload, frequency, occurrences },
        });
        if (result.created.length === 0) {
          setError("Every date in that series conflicts with an existing appointment. Nothing was booked.");
          return;
        }
        if (result.skipped.length > 0) {
          alert(
            `${result.created.length} of ${occurrences} appointments booked. ${result.skipped.length} skipped because that time was already taken.`
          );
        }
      } else {
        await apiFetch("/api/scheduling/appointments/", { method: "POST", body: basePayload });
      }
      if (addingClient) onClientAdded();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedService = services.find((s) => s.id === serviceId);
  const timeLabel = (() => {
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  })();

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[1fr_260px]"
    >
      {/* Left: the actual booking fields, icon-led instead of grouped
          under an awkward "Who & what" / "When & how long" label. */}
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-2.5">
          <span className="accent-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <CalendarPlus className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900">New appointment</p>
            <p className="text-xs text-gray-500">
              {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {addingClient ? (
          <div className="rounded-xl border border-[var(--accent-600,#059669)]/25 bg-[var(--accent-50,#ecfdf5)] p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <UserPlus className="h-3.5 w-3.5 text-gray-500" strokeWidth={2} />
                New client
              </span>
              <button
                type="button"
                onClick={() => {
                  setAddingClient(false);
                  setNewFirstName("");
                  setNewLastName("");
                  setNewEmail("");
                  setNewPhone("");
                }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3" strokeWidth={2} />
                Pick an existing client instead
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Field label="First name" required value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
              <Field label="Last name" required value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
              <Field label="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <Field label="Phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block">
                <FieldLabel icon={User}>Client</FieldLabel>
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(Number(e.target.value))}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select a client
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setAddingClient(true)}
                className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--accent-700,#047857)] hover:underline"
              >
                <UserPlus className="h-3 w-3" strokeWidth={2} />
                New client
              </button>
            </div>
            <label className="block">
              <FieldLabel icon={Tag}>Service</FieldLabel>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : "")}
                className={inputClass}
              >
                <option value="">No service selected</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          <label className="block">
            <FieldLabel icon={Clock}>Time</FieldLabel>
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <FieldLabel icon={Timer}>Duration</FieldLabel>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass}>
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <FieldLabel icon={StickyNote}>Notes</FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything worth remembering about this appointment…"
            className={inputClass}
          />
        </label>

        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
          <label className="flex cursor-pointer items-center justify-between text-sm font-medium text-gray-700">
            <span className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
              Recurring appointment
            </span>
            {/* A real switch rather than a bare checkbox — makes the
                on/off state legible at a glance instead of a tiny box
                easy to miss next to the label. */}
            <span
              onClick={() => setIsRecurring((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                isRecurring ? "accent-bg" : "bg-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="sr-only"
              />
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  isRecurring ? "translate-x-[18px]" : "translate-x-1"
                }`}
              />
            </span>
          </label>
          {isRecurring && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="block text-sm">
                Repeats
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as "weekly" | "biweekly" | "monthly")}
                  className={inputClass}
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Total appointments
                <input
                  type="number"
                  min={2}
                  max={52}
                  value={occurrences}
                  onChange={(e) => setOccurrences(Number(e.target.value))}
                  className={inputClass}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Right: a live summary of what's about to be booked, plus the
          save action — turns the wide-card dead space into something
          useful (a checkout-style preview) instead of empty padding,
          and keeps the primary action anchored next to what it commits
          to instead of floating at the bottom of a long form. */}
      <div className="flex flex-col justify-between gap-4 border-t border-gray-100 bg-gray-50/60 p-5 lg:border-l lg:border-t-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Summary</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Client</dt>
              <dd className="font-medium text-gray-900">
                {addingClient ? newFirstName || newLastName ? `${newFirstName} ${newLastName}`.trim() : "New client" : selectedClient?.full_name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Service</dt>
              <dd className="font-medium text-gray-900">{selectedService?.name ?? "No service selected"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Date &amp; time</dt>
              <dd className="font-medium text-gray-900">
                {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {timeLabel ? ` · ${timeLabel}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Duration</dt>
              <dd className="font-medium text-gray-900">{formatDuration(duration)}</dd>
            </div>
            {isRecurring && (
              <div>
                <dt className="text-xs text-gray-400">Repeats</dt>
                <dd className="font-medium text-gray-900">
                  {FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.label}, {occurrences} total
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="space-y-2">
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Saving…" : "Book appointment"}
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </form>
  );
}
