"use client";

import { useState } from "react";

import { Button } from "@/components/form";

import { AddAppointmentForm } from "./AddAppointmentForm";
import { appointmentsOn, businessHoursFor } from "./helpers";
import type { Appointment, BusinessHour, Client } from "./types";

// ----------------------------------------------------------------------------
// A real time-grid day view — per Mako: people need to actually SEE
// which times are free, not just a flat list of who's booked. This
// draws a vertical timeline in 15-minute slots (a labeled line every 30
// minutes, a lighter tick at the 15-minute mark between them) and
// places each appointment as a block sized to its actual duration, so
// an empty stretch of grid visually IS the available time.
//
// Clicking any empty slot opens the add-appointment form pre-filled
// with that time — "click the gap you want, book it" is the whole
// point of drawing this as a grid instead of a list.
// ----------------------------------------------------------------------------

const SLOT_MINUTES = 15;
const SLOT_HEIGHT_PX = 22;
// Fallback range for a closed day (or one with no hours set at all) —
// the grid still has to show SOMETHING to click on, so this stands in
// for "typical business hours" rather than showing a blank card.
const DEFAULT_START_MINUTES = 8 * 60; // 8:00 AM
const DEFAULT_END_MINUTES = 18 * 60; // 6:00 PM

function timeToMinutes(hhmmss: string) {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function minutesToHHMM(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Rounds down/up to the nearest 15-minute mark, so the grid's range
// always lines up cleanly with the slot lines even when an appointment
// starts or ends at an odd time.
function floorTo15(minutes: number) {
  return Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}
function ceilTo15(minutes: number) {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

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
  const [addFormTime, setAddFormTime] = useState<string | null>(null); // "HH:MM" of the slot last clicked, or null when the form's closed

  const dayAppointments = appointmentsOn(appointments, date);
  const businessHour = businessHoursFor(hours, date);

  function clientNameFor(clientId: number) {
    return clients.find((c) => c.id === clientId)?.name ?? "Client";
  }

  // The grid's range is business hours by default, but widened to cover
  // any appointment that falls outside them (e.g. hours changed after
  // something was booked) — nothing should ever end up clipped off the
  // visible grid.
  let rangeStart =
    businessHour?.is_open && businessHour.open_time ? timeToMinutes(businessHour.open_time) : DEFAULT_START_MINUTES;
  let rangeEnd =
    businessHour?.is_open && businessHour.close_time ? timeToMinutes(businessHour.close_time) : DEFAULT_END_MINUTES;
  for (const appt of dayAppointments) {
    const start = minutesSinceMidnight(new Date(appt.datetime));
    rangeStart = Math.min(rangeStart, floorTo15(start));
    rangeEnd = Math.max(rangeEnd, ceilTo15(start + appt.duration_minutes));
  }

  const slots = [];
  for (let m = rangeStart; m < rangeEnd; m += SLOT_MINUTES) slots.push(m);

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
        <Button
          onClick={() => setAddFormTime(addFormTime === null ? minutesToHHMM(rangeStart) : null)}
        >
          {addFormTime !== null ? "Cancel" : "Add appointment"}
        </Button>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {businessHour?.is_open ? "Open" : "Closed"}
        {businessHour?.is_open && businessHour.open_time && businessHour.close_time
          ? ` ${minutesToLabel(timeToMinutes(businessHour.open_time))} – ${minutesToLabel(timeToMinutes(businessHour.close_time))}`
          : ""}
        {" · click an open slot below to book it"}
      </p>

      {addFormTime !== null && (
        <div className="mt-3 rounded-md border border-gray-200 p-3">
          <AddAppointmentForm
            key={addFormTime} // remounts with a fresh initial time whenever a different slot is clicked — see the note in AddAppointmentForm.tsx
            calendarId={calendarId}
            clients={clients}
            date={date}
            initialTime={addFormTime}
            onDone={() => {
              setAddFormTime(null);
              onChanged();
            }}
          />
        </div>
      )}

      {/* The time grid itself: a stack of 15-minute slots (a labeled,
          solid line every 30 minutes; a lighter tick at the in-between
          15-minute mark), with appointment blocks absolutely positioned
          on top, sized to their actual duration. */}
      <div className="relative mt-4 select-none" style={{ height: slots.length * SLOT_HEIGHT_PX }}>
        {slots.map((minutes) => {
          const isHourOrHalf = minutes % 30 === 0;
          return (
            <button
              key={minutes}
              onClick={() => setAddFormTime(minutesToHHMM(minutes))}
              className={`absolute inset-x-0 flex items-start pl-14 text-left hover:bg-emerald-50/60 ${
                isHourOrHalf ? "border-t border-gray-200" : "border-t border-dashed border-gray-100"
              }`}
              style={{ top: ((minutes - rangeStart) / SLOT_MINUTES) * SLOT_HEIGHT_PX, height: SLOT_HEIGHT_PX }}
            >
              {isHourOrHalf && (
                <span className="-mt-2 w-12 shrink-0 text-right text-[11px] text-gray-400">
                  {minutesToLabel(minutes)}
                </span>
              )}
            </button>
          );
        })}

        {dayAppointments.map((appt) => {
          const start = minutesSinceMidnight(new Date(appt.datetime));
          const top = (start - rangeStart) * (SLOT_HEIGHT_PX / SLOT_MINUTES);
          const height = Math.max(appt.duration_minutes * (SLOT_HEIGHT_PX / SLOT_MINUTES), SLOT_HEIGHT_PX * 0.8);
          return (
            <div
              key={appt.id}
              className="absolute left-14 right-1 overflow-hidden rounded-md bg-emerald-500 px-2 py-1 text-xs text-white shadow-sm"
              style={{ top, height }}
            >
              <p className="truncate font-medium">{clientNameFor(appt.client)}</p>
              <p className="truncate text-emerald-50">
                {minutesToLabel(start)} · {appt.duration_minutes} min
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
