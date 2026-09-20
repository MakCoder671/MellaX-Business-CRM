"use client";

import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, ErrorText } from "@/components/form";

import type { Client } from "./types";

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

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export function AddAppointmentForm({
  calendarId,
  clients,
  date,
  initialTime = "09:00",
  onDone,
}: {
  calendarId: number;
  clients: Client[];
  date: Date;
  initialTime?: string; // "HH:MM" — lets DayView's time grid pre-fill the slot someone clicked
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState<number | "">("");
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const [hours, minutes] = time.split(":").map(Number);
      const localDatetime = new Date(date);
      localDatetime.setHours(hours, minutes, 0, 0);

      await apiFetch("/api/scheduling/appointments/", {
        method: "POST",
        body: {
          calendar: calendarId,
          client: clientId,
          datetime: localDatetime.toISOString(),
          duration_minutes: duration,
          status: "scheduled",
          source: "manual",
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        Client
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(Number(e.target.value))}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Select
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Time
        <input
          type="time"
          required
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-sm">
        Duration
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr${minutes > 60 ? "s" : ""}`}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Add"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
