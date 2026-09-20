"use client";

import { useState } from "react";

import { AddAppointmentForm } from "./AddAppointmentForm";
import { appointmentsOn, businessHoursFor, formatHourString, formatTime, startOfWeek } from "./helpers";
import type { Appointment, BusinessHour, Client } from "./types";

// ----------------------------------------------------------------------------
// The week view — an agenda-style list, one section per day, each
// showing EVERY appointment that day (no cap, matching Mako's "I want
// to see it all" for Day/Week — only Month is meant to be a density
// overview). A grid-of-tiny-boxes layout (like the old week view) would
// just reintroduce the same cramped-cell problem Month already has, so
// this deliberately isn't shaped like Month at all.
// ----------------------------------------------------------------------------

export function WeekView({
  calendarId,
  hours,
  appointments,
  clients,
  onChanged,
}: {
  calendarId: number;
  hours: BusinessHour[];
  appointments: Appointment[];
  clients: Client[];
  onChanged: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  // Which day's add-appointment form is open, if any — only one at a
  // time, keyed by the day's date string so it's easy to check "is this
  // the open one" per section below.
  const [addFormDay, setAddFormDay] = useState<string | null>(null);

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  function clientNameFor(clientId: number) {
    return clients.find((c) => c.id === clientId)?.name ?? "Client";
  }

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          ←
        </button>
        <h3 className="text-base font-medium">{weekLabel}</h3>
        <button
          onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          →
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          Today
        </button>
      </div>

      <div className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">
        {days.map((date) => {
          const dayKey = date.toDateString();
          const dayAppointments = appointmentsOn(appointments, date);
          const businessHour = businessHoursFor(hours, date);
          const isToday = date.toDateString() === today.toDateString();
          const isFormOpen = addFormDay === dayKey;

          return (
            <div key={dayKey} className={`p-3 ${isToday ? "bg-emerald-50/40" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-sm font-medium ${isToday ? "text-emerald-700" : "text-gray-900"}`}>
                    {date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {businessHour?.is_open && businessHour.open_time && businessHour.close_time
                      ? `${formatHourString(businessHour.open_time)} – ${formatHourString(businessHour.close_time)}`
                      : "Closed"}
                  </span>
                </div>
                <button
                  onClick={() => setAddFormDay(isFormOpen ? null : dayKey)}
                  className="text-xs text-emerald-700 underline"
                >
                  {isFormOpen ? "Cancel" : "+ Add"}
                </button>
              </div>

              {isFormOpen && (
                <div className="mt-2 rounded-md border border-gray-200 p-2">
                  <AddAppointmentForm
                    calendarId={calendarId}
                    clients={clients}
                    date={date}
                    onDone={() => {
                      setAddFormDay(null);
                      onChanged();
                    }}
                  />
                </div>
              )}

              {dayAppointments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {dayAppointments.map((appt) => (
                    <li
                      key={appt.id}
                      className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800"
                    >
                      <span>{clientNameFor(appt.client)}</span>
                      <span>{formatTime(new Date(appt.datetime))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
