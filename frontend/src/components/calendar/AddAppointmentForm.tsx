"use client";

import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, ErrorText } from "@/components/form";

import type { Client } from "./types";

// Shared by DayView, WeekView, and MonthView — one client picker + time
// picker, always for a date the caller already knows (the day being
// viewed, or the day clicked in the month grid), so there's no separate
// date field here.

export function AddAppointmentForm({
  calendarId,
  clients,
  date,
  onDone,
}: {
  calendarId: number;
  clients: Client[];
  date: Date;
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState<number | "">("");
  const [time, setTime] = useState("09:00");
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
              {c.name}
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
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Add"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
