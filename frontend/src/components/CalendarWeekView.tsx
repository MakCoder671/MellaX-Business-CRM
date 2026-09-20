"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText } from "@/components/form";

// ----------------------------------------------------------------------------
// A compact week-at-a-glance calendar for the dashboard Overview page.
// Per business_plan.MD, v1 is deliberately simple: "single/default
// calendar, manual entry" — no drag-and-drop, no multi-calendar view
// (that's a Plus feature for later). This just answers "what's on this
// week, and is today even a day we're open" in one glance.
//
// It reads Operating Hours (Settings) to show closed days as closed —
// that's the whole point of putting this here per Mako's note: the
// calendar should visibly reflect what Operating Hours says, not be a
// separate thing someone has to cross-reference by hand.
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Converts our Monday=0..Sunday=6 day-of-week convention (matching the
// backend) into JavaScript's native Sunday=0..Saturday=6 Date.getDay()
// convention, so the two can be compared directly.
function toJsDayOfWeek(backendDayOfWeek: number) {
  return (backendDayOfWeek + 1) % 7;
}

// The Sunday that starts the week containing `date`.
function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatTime(hhmmss: string) {
  // "14:00:00" -> "2:00 PM" — a friendlier display than the raw 24-hour
  // string the backend stores.
  const [hours, minutes] = hhmmss.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function AddAppointmentForm({
  calendarId,
  clients,
  defaultDate,
  onDone,
}: {
  calendarId: number;
  clients: Client[];
  defaultDate: string;
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState<number | "">("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Combining the date and time inputs into one ISO-ish string that
      // JavaScript's Date parser understands as LOCAL time, then handing
      // that off as an ISO string — the backend just stores whatever
      // instant that resolves to (see scheduling/models.py's Appointment.datetime).
      const localDatetime = new Date(`${date}T${time}:00`);
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
    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-200 pt-4">
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
        Date
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
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
        {submitting ? "Saving…" : "Save"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export function CalendarWeekView() {
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [hours, setHours] = useState<BusinessHour[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
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

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const businessHour = hours.find((h) => toJsDayOfWeek(h.day_of_week) === date.getDay());
    const dayAppointments = appointments
      .filter((a) => new Date(a.datetime).toDateString() === date.toDateString())
      .sort((a, b) => a.datetime.localeCompare(b.datetime));
    return { date, businessHour, appointments: dayAppointments };
  });

  const today = new Date().toDateString();
  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Calendar</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ←
          </button>
          <span className="text-sm text-gray-600">{weekLabel}</span>
          <button
            onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            →
          </button>
          <Button onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Cancel" : "Add appointment"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const isToday = day.date.toDateString() === today;
          const isOpen = day.businessHour?.is_open ?? false;
          return (
            <div
              key={day.date.toISOString()}
              className={`rounded-md border p-2 text-xs ${isToday ? "border-emerald-400" : "border-gray-200"} ${
                isOpen ? "bg-white" : "bg-gray-50"
              }`}
            >
              <p className={`font-medium ${isToday ? "text-emerald-700" : "text-gray-700"}`}>
                {DAY_NAMES[day.date.getDay()]} {day.date.getDate()}
              </p>
              {!isOpen ? (
                <p className="text-gray-400">Off</p>
              ) : day.businessHour?.open_time && day.businessHour?.close_time ? (
                <p className="text-gray-400">
                  {formatTime(day.businessHour.open_time)} – {formatTime(day.businessHour.close_time)}
                </p>
              ) : (
                // is_open is true but no hours are set — genuinely
                // different from closed, so this shouldn't ever claim
                // "Off" (Settings' Operating Hours form fills in real
                // defaults now, but this stays correct even for older
                // rows or ones edited directly through the API/admin).
                <p className="text-gray-400">Open</p>
              )}
              <ul className="mt-1 space-y-0.5">
                {day.appointments.map((appt) => (
                  <li key={appt.id} className="truncate rounded bg-emerald-50 px-1 py-0.5 text-emerald-700">
                    {new Date(appt.datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    {" · "}
                    {clients.find((c) => c.id === appt.client)?.name ?? "Client"}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {showAddForm && (
        <AddAppointmentForm
          calendarId={calendarId}
          clients={clients}
          defaultDate={new Date().toISOString().slice(0, 10)}
          onDone={() => {
            setShowAddForm(false);
            loadAppointments(calendarId);
          }}
        />
      )}
    </Card>
  );
}
