"use client";

import { useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";

import { Button } from "@/components/form";

import { AddAppointmentForm } from "./AddAppointmentForm";
import {
  appointmentChipClasses,
  appointmentsOn,
  clientName,
  formatDuration,
  isClosedDay,
  isNoShow,
  sameDay,
  serviceName,
} from "./helpers";
import type { Appointment, BusinessHour, Client, Service } from "./types";

// ----------------------------------------------------------------------------
// The month grid — a density overview, not a full-detail view (that's
// what Day/Week are for). Each cell shows up to 2 appointment chips plus
// a "+N more" overflow, since a full month's worth of appointments
// couldn't possibly fit in a cell this small without it — the point of
// Month is "see booking density across the month," not "read every name."
// ----------------------------------------------------------------------------

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export function MonthView({
  calendarId,
  hours,
  appointments,
  clients,
  services,
  onChanged,
  onClientAdded,
  onSelectAppointment,
}: {
  calendarId: number;
  hours: BusinessHour[];
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  onChanged: () => void;
  onClientAdded: () => void;
  onSelectAppointment: (appointment: Appointment) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showAddForm, setShowAddForm] = useState(false);

  const gridDays = getMonthGridDays(viewMonth);
  const today = new Date();
  const selectedDayAppointments = appointmentsOn(appointments, selectedDate);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">
          {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
          >
            ←
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setViewMonth(now);
              setSelectedDate(now);
            }}
            className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
          >
            Today
          </button>
          <button
            onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
          >
            →
          </button>
        </div>
      </div>

      {/* The grid itself: 7 weekday headers, then 6 weeks of 7 day-cells.
          A single CSS grid with 7 columns handles both rows at once -
          the 1px gap (gap-px) shows the grid's own background color
          through it, which is what actually draws "the lines" between
          cells, so tinting that background is what colors the whole
          grid's line-work at once. */}
      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-md border border-[var(--cal-600,#059669)]/25 bg-[var(--cal-600,#059669)]/20 text-xs">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className="bg-[var(--cal-50,#ecfdf5)] p-1.5 text-center font-medium text-gray-500">
            {day}
          </div>
        ))}

        {gridDays.map((date) => {
          const inCurrentMonth = date.getMonth() === viewMonth.getMonth();
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, selectedDate);
          const dayAppointments = appointmentsOn(appointments, date);
          const closed = isClosedDay(hours, date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => {
                setSelectedDate(date);
                setShowAddForm(false);
              }}
              className={`flex h-20 flex-col items-start p-1.5 text-left transition-colors ${
                isSelected
                  ? "bg-[var(--cal-50,#ecfdf5)] ring-1 ring-inset ring-[var(--cal-500,#10b981)]"
                  : "bg-white hover:bg-gray-50"
              } ${!inCurrentMonth ? "opacity-40" : ""} ${closed && inCurrentMonth ? "bg-gray-50" : ""}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday ? "cal-accent-bg font-medium" : "text-gray-700"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 w-full space-y-0.5 overflow-hidden">
                {dayAppointments.slice(0, 2).map((appt, index) => {
                  const service = serviceName(services, appt.service);
                  return (
                    // A <p>, not a nested <button> — this chip sits inside
                    // the day cell's own <button> (for "select this day"),
                    // and a button can't contain another button. Stopping
                    // propagation is what keeps a chip click from ALSO
                    // triggering the day-select underneath it.
                    <p
                      key={appt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAppointment(appt);
                      }}
                      className={`flex items-center gap-1 truncate rounded px-1 text-[10px] font-medium ${appointmentChipClasses(appt.status, index % 2 === 1)}`}
                    >
                      {isNoShow(appt.status) && <AlertTriangle className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />}
                      <span className="shrink-0 font-normal opacity-80">
                        {new Date(appt.datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="truncate">{clientName(clients, appt.client)}</span>
                      {service && <span className="truncate font-normal opacity-80">· {service}</span>}
                    </p>
                  );
                })}
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
            {isClosedDay(hours, selectedDate) && <span className="ml-2 text-xs text-gray-400">(Closed)</span>}
          </h3>
          {/* Per Operating Hours (Settings): a closed day blocks booking
              through the calendar entirely — same rule as Day and Week. */}
          {!isClosedDay(hours, selectedDate) && (
            <Button onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? "Cancel" : "Add appointment"}
            </Button>
          )}
        </div>

        {selectedDayAppointments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            {isClosedDay(hours, selectedDate) ? "Closed all day — nothing to book." : "Nothing booked this day."}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {selectedDayAppointments.map((appt, index) => {
              const service = serviceName(services, appt.service);
              return (
                <li key={appt.id}>
                  {/* Name, service, and duration each on their own line
                      (not squeezed onto one row with the time) - this
                      list has plenty of room, so the name gets sized and
                      weighted like a small heading and everything below
                      it reads as a clear, organized hierarchy instead of
                      one run-on line. */}
                  <button
                    onClick={() => onSelectAppointment(appt)}
                    className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left ${appointmentChipClasses(appt.status, index % 2 === 1)}`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-bold sm:text-base">
                      {isNoShow(appt.status) && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                      )}
                      {clientName(clients, appt.client)}
                    </span>
                    {service && (
                      <span className="inline-block w-fit max-w-full truncate rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold shadow-sm">
                        {service}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs opacity-80">
                      <Clock className="h-3 w-3 shrink-0" strokeWidth={2} />
                      {new Date(appt.datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} ·{" "}
                      {formatDuration(appt.duration_minutes)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {showAddForm && (
          <div className="mt-3">
            <AddAppointmentForm
              calendarId={calendarId}
              clients={clients}
              services={services}
              date={selectedDate}
              onClientAdded={onClientAdded}
              onDone={() => {
                setShowAddForm(false);
                onChanged();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
