"use client";

import { useState } from "react";

import { AddAppointmentForm } from "./AddAppointmentForm";
import {
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  ceilTo15,
  floorTo15,
  minutesSinceMidnight,
  minutesToHHMM,
  minutesToLabel,
  minutesToPx,
  timeToMinutes,
} from "./gridHelpers";
import { appointmentsOn, businessHoursFor, startOfWeek } from "./helpers";
import type { Appointment, BusinessHour, Client } from "./types";

// ----------------------------------------------------------------------------
// The week view — per Mako, this should look like DayView's time grid,
// just seven days wide instead of one. Same 15-minute slots, same
// 30-minute labeled lines, same "click an open slot to book it" — the
// only real new problem a week adds is that each day can have its OWN
// Operating Hours, but the grid still needs one shared time axis so the
// lines actually line up across all seven columns.
//
// So: the grid's vertical range is the union of every open day's hours
// this week (widened to cover any appointment outside that, same as
// DayView). Within that shared range, each day's own column only
// accepts clicks inside ITS OWN hours — a day that opens later than the
// earliest day this week just shows its early-morning rows grayed out
// and non-interactive, same idea as DayView's "closed blocks booking,"
// applied per-column instead of to the whole grid at once.
// ----------------------------------------------------------------------------

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AddFormTarget = { date: Date; time: string } | null;

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
  const [addForm, setAddForm] = useState<AddFormTarget>(null);

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  function clientNameFor(clientId: number) {
    return clients.find((c) => c.id === clientId)?.name ?? "Client";
  }

  // The shared range: earliest open time to latest close time across
  // whichever days are open, widened to fit any appointment that falls
  // outside it. If every day this week is closed, fall back to a plain
  // 9-5 shape just so the grid has something to draw — every column
  // will still show "Closed" regardless.
  const openHours = hours.filter((h) => h.is_open && h.open_time && h.close_time);
  let rangeStart = openHours.length
    ? Math.min(...openHours.map((h) => timeToMinutes(h.open_time as string)))
    : 9 * 60;
  let rangeEnd = openHours.length
    ? Math.max(...openHours.map((h) => timeToMinutes(h.close_time as string)))
    : 17 * 60;

  const weekAppointments = days.flatMap((date) => appointmentsOn(appointments, date));
  for (const appt of weekAppointments) {
    const start = minutesSinceMidnight(new Date(appt.datetime));
    rangeStart = Math.min(rangeStart, floorTo15(start));
    rangeEnd = Math.max(rangeEnd, ceilTo15(start + appt.duration_minutes));
  }

  const slots: number[] = [];
  for (let m = rangeStart; m < rangeEnd; m += SLOT_MINUTES) slots.push(m);
  const gridHeight = slots.length * SLOT_HEIGHT_PX;

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

      {addForm && (
        <div className="mt-3 rounded-md border border-gray-200 p-3">
          <p className="mb-2 text-xs font-medium text-gray-500">
            {addForm.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <AddAppointmentForm
            key={`${addForm.date.toDateString()}-${addForm.time}`} // remounts with fresh values whenever a different day/slot is clicked
            calendarId={calendarId}
            clients={clients}
            date={addForm.date}
            initialTime={addForm.time}
            onDone={() => {
              setAddForm(null);
              onChanged();
            }}
          />
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-md border border-gray-300 select-none">
        {/* Day-name header row — same gutter width + divider as the body
            below, so the day columns line up exactly with their names. */}
        <div className="flex border-b border-gray-300 bg-gray-50">
          <div className="w-16 shrink-0" />
          <div className="w-px shrink-0 bg-gray-300" />
          {days.map((date) => {
            const isToday = date.toDateString() === today.toDateString();
            return (
              <div
                key={date.toDateString()}
                className={`flex-1 border-r border-gray-200 py-1.5 text-center text-xs font-medium last:border-r-0 ${
                  isToday ? "bg-emerald-50 text-emerald-700" : "text-gray-600"
                }`}
              >
                {DAY_ABBR[date.getDay()]} {date.getDate()}
              </div>
            );
          })}
        </div>

        {/* Body: the same time-label gutter as DayView, then seven
            schedule columns sharing one time axis. */}
        <div className="flex" style={{ height: gridHeight }}>
          <div className="relative w-16 shrink-0 bg-gray-50">
            {slots
              .filter((minutes) => minutes % 30 === 0)
              .map((minutes) => (
                <div
                  key={minutes}
                  className="absolute inset-x-0 flex items-center justify-end whitespace-nowrap border-t border-gray-300 pr-2 text-[11px] font-medium text-gray-500"
                  style={{ top: minutesToPx(minutes, rangeStart), height: SLOT_HEIGHT_PX * 2 }}
                >
                  {minutesToLabel(minutes)}
                </div>
              ))}
          </div>
          <div className="w-px shrink-0 bg-gray-300" />

          {days.map((date) => {
            const businessHour = businessHoursFor(hours, date);
            const isOpen = businessHour?.is_open ?? false;
            const dayOpenStart = isOpen && businessHour?.open_time ? timeToMinutes(businessHour.open_time) : null;
            const dayCloseEnd = isOpen && businessHour?.close_time ? timeToMinutes(businessHour.close_time) : null;
            const dayAppointments = appointmentsOn(appointments, date);
            const isToday = date.toDateString() === today.toDateString();

            return (
              <div
                key={date.toDateString()}
                className={`relative flex-1 border-r border-gray-200 last:border-r-0 ${isToday ? "bg-emerald-50/30" : ""}`}
              >
                {!isOpen ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-[11px] text-gray-400">
                    Closed
                  </div>
                ) : (
                  <>
                    {slots.map((minutes) => {
                      const withinHours = dayOpenStart !== null && dayCloseEnd !== null && minutes >= dayOpenStart && minutes < dayCloseEnd;
                      const isHourOrHalf = minutes % 30 === 0;

                      // Outside this specific day's hours (even though
                      // the day itself is open) — a plain, non-clickable
                      // gray strip, same "Operating Hours blocks
                      // booking" rule as DayView, just per-column here.
                      if (!withinHours) {
                        return (
                          <div
                            key={minutes}
                            className="absolute inset-x-0 bg-gray-50"
                            style={{ top: minutesToPx(minutes, rangeStart), height: SLOT_HEIGHT_PX }}
                          />
                        );
                      }

                      return (
                        <button
                          key={minutes}
                          onClick={() => setAddForm({ date, time: minutesToHHMM(minutes) })}
                          className={`absolute inset-x-0 hover:bg-emerald-50/60 ${
                            isHourOrHalf ? "border-t border-gray-200" : "border-t border-dashed border-gray-100"
                          }`}
                          style={{ top: minutesToPx(minutes, rangeStart), height: SLOT_HEIGHT_PX }}
                        />
                      );
                    })}

                    {dayAppointments.map((appt) => {
                      const start = minutesSinceMidnight(new Date(appt.datetime));
                      const top = minutesToPx(start, rangeStart);
                      const height = Math.max(appt.duration_minutes * (SLOT_HEIGHT_PX / SLOT_MINUTES), SLOT_HEIGHT_PX * 0.8);
                      return (
                        <div
                          key={appt.id}
                          className="absolute left-0.5 right-0.5 overflow-hidden rounded border border-emerald-700 bg-emerald-500 px-1 py-0.5 text-[10px] leading-tight text-white shadow-sm"
                          style={{ top, height }}
                        >
                          <p className="truncate font-medium">{clientNameFor(appt.client)}</p>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
