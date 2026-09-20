"use client";

import { useState } from "react";

import { Button } from "@/components/form";

import { AddAppointmentForm } from "./AddAppointmentForm";
import { appointmentsOn, businessHoursFor, formatHourString, formatTime } from "./helpers";
import type { Appointment, BusinessHour, Client } from "./types";

// ----------------------------------------------------------------------------
// The full-detail single-day view — per Mako: "people like to just see
// the day which visually, you will see all clients names." No cap, no
// "+N more" — every appointment for the day gets its own row.
// ----------------------------------------------------------------------------

export function DayView({
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
  const [date, setDate] = useState(() => new Date());
  const [showAddForm, setShowAddForm] = useState(false);

  const dayAppointments = appointmentsOn(appointments, date);
  const businessHour = businessHoursFor(hours, date);

  function clientNameFor(clientId: number) {
    return clients.find((c) => c.id === clientId)?.name ?? "Client";
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            ←
          </button>
          <h3 className="text-base font-medium">
            {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          <button
            onClick={() => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            →
          </button>
          <button
            onClick={() => setDate(new Date())}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Today
          </button>
        </div>
        <Button onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "Add appointment"}
        </Button>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {businessHour?.is_open && businessHour.open_time && businessHour.close_time
          ? `Open ${formatHourString(businessHour.open_time)} – ${formatHourString(businessHour.close_time)}`
          : "Closed"}
      </p>

      {showAddForm && (
        <div className="mt-3 rounded-md border border-gray-200 p-3">
          <AddAppointmentForm
            calendarId={calendarId}
            clients={clients}
            date={date}
            onDone={() => {
              setShowAddForm(false);
              onChanged();
            }}
          />
        </div>
      )}

      {dayAppointments.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Nothing booked this day.</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {dayAppointments.map((appt) => (
            <li
              key={appt.id}
              className="flex items-center justify-between rounded-md bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
            >
              <span className="font-medium">{clientNameFor(appt.client)}</span>
              <span>{formatTime(new Date(appt.datetime))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
