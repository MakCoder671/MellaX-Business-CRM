"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText } from "@/components/form";

// ----------------------------------------------------------------------------
// A real month-grid calendar for the dashboard Overview page — the
// traditional wall-calendar layout (weeks as rows, days as columns),
// since that's what actually reads as "a calendar" at a glance and
// shows booking density across the month, not just a single week's
// worth of little boxes in a row (the previous version).
//
// Per business_plan.MD, v1 is still deliberately simple: "single/
// default calendar, manual entry" — no drag-and-drop, no resizing, no
// multi-calendar view (that's Plus). Clicking a day selects it and
// shows its full appointment list + an add-appointment form below the
// grid, since cramming full details into tiny grid cells doesn't work.
// ----------------------------------------------------------------------------

type BusinessHour = {
  day_of_week: number; // 0=Monday ... 6=Sunday, see scheduling/models.py
  open_time: string | null;
  close_time: string | null;
  is_open: boolean;
};

type Client = { id: number; name: string };

type Appointment = {
  id: number;
  client: number;
  datetime: string; // ISO datetime string
  status: "scheduled" | "completed" | "cancelled";
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Converts our Monday=0..Sunday=6 day-of-week convention (matching the
// backend) into JavaScript's native Sunday=0..Saturday=6 Date.getDay()
// convention, so the two can be compared directly.
function toJsDayOfWeek(backendDayOfWeek: number) {
  return (backendDayOfWeek + 1) % 7;
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// The 42 (6 weeks x 7 days) cells to render for a month grid, starting
// from the Sunday on/before the 1st and running long enough to always
// fully cover the month — a fixed 6 rows keeps the grid's height
// consistent from month to month instead of jumping around.
function getMonthGridDays(viewMonth: Date) {
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    return date;
  });
}

function AddAppointmentForm({
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

export function CalendarMonthView() {
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [hours, setHours] = useState<BusinessHour[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showAddForm, setShowAddForm] = useState(false);

  function loadAppointments(forCalendarId: number) {
    apiFetch<Appointment[]>(`/api/scheduling/appointments/?calendar=${forCalendarId}`).then(setAppointments);
  }

  useEffect(() => {
    apiFetch<{ id: number }>("/api/scheduling/calendars/default/").then((cal) => {
      setCalendarId(cal.id);
      loadAppointments(cal.id);
    });
    apiFetch<BusinessHour[]>("/api/scheduling/business-hours/").then(setHours);
    apiFetch<Client[]>("/api/clients/").then(setClients);
  }, []);

  if (hours === null || appointments === null || calendarId === null) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-500">Loading calendar…</p>
      </Card>
    );
  }

  const gridDays = getMonthGridDays(viewMonth);
  const today = new Date();

  function appointmentsOn(date: Date) {
    return (appointments ?? [])
      .filter((a) => sameDay(new Date(a.datetime), date))
      .sort((a, b) => a.datetime.localeCompare(b.datetime));
  }

  function isClosedDay(date: Date) {
    const businessHour = hours?.find((h) => toJsDayOfWeek(h.day_of_week) === date.getDay());
    return !(businessHour?.is_open ?? false);
  }

  function clientName(clientId: number) {
    return clients.find((c) => c.id === clientId)?.name ?? "Client";
  }

  const selectedDayAppointments = appointmentsOn(selectedDate);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            ←
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setViewMonth(now);
              setSelectedDate(now);
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            →
          </button>
        </div>
      </div>

      {/* The grid itself: 7 weekday headers, then 6 weeks of 7 day-cells.
          A single CSS grid with 7 columns handles both rows at once. */}
      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 text-xs">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className="bg-gray-50 p-1.5 text-center font-medium text-gray-500">
            {day}
          </div>
        ))}

        {gridDays.map((date) => {
          const inCurrentMonth = date.getMonth() === viewMonth.getMonth();
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, selectedDate);
          const dayAppointments = appointmentsOn(date);
          const closed = isClosedDay(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => {
                setSelectedDate(date);
                setShowAddForm(false);
              }}
              className={`flex h-20 flex-col items-start p-1.5 text-left transition-colors ${
                isSelected ? "bg-emerald-50 ring-1 ring-inset ring-emerald-500" : "bg-white hover:bg-gray-50"
              } ${!inCurrentMonth ? "opacity-40" : ""} ${closed && inCurrentMonth ? "bg-gray-50" : ""}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday ? "bg-emerald-600 font-medium text-white" : "text-gray-700"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 w-full space-y-0.5 overflow-hidden">
                {dayAppointments.slice(0, 2).map((appt) => (
                  <p key={appt.id} className="truncate rounded bg-emerald-100 px-1 text-[10px] text-emerald-800">
                    {new Date(appt.datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{" "}
                    {clientName(appt.client)}
                  </p>
                ))}
                {dayAppointments.length > 2 && (
                  <p className="px-1 text-[10px] text-gray-500">+{dayAppointments.length - 2} more</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Details for whichever day is selected — this is where "click a
          day, see what's booked, add something" actually happens, since
          the grid cells above are too small to hold full details. */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {isClosedDay(selectedDate) && <span className="ml-2 text-xs text-gray-400">(Closed)</span>}
          </h3>
          <Button onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Cancel" : "Add appointment"}
          </Button>
        </div>

        {selectedDayAppointments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nothing booked this day.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {selectedDayAppointments.map((appt) => (
              <li key={appt.id} className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
                <span>{clientName(appt.client)}</span>
                <span>{new Date(appt.datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        )}

        {showAddForm && calendarId && (
          <div className="mt-3">
            <AddAppointmentForm
              calendarId={calendarId}
              clients={clients}
              date={selectedDate}
              onDone={() => {
                setShowAddForm(false);
                loadAppointments(calendarId);
              }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
