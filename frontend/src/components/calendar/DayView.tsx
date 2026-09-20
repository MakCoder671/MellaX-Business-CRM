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
//
// Operating Hours (Settings) is the source of truth for the grid's
// range on an open day, AND for whether booking is even allowed at
// all: a day marked closed there shows no grid and no way to add an
// appointment through it — "Off" means off, not "a made-up default
// range you can still book into."
// ----------------------------------------------------------------------------

const SLOT_MINUTES = 15;
const SLOT_HEIGHT_PX = 22;

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

function DayNav({
  date,
  setDate,
}: {
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
}) {
  return (
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
  );
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

  // A day Operating Hours marks closed is genuinely off — no grid, no
  // slot-click booking. Existing appointments (booked before the day
  // was marked closed, say) still show, just as a plain read-only list
  // with nothing to click into, rather than hiding real data.
  if (!businessHour?.is_open) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <DayNav date={date} setDate={setDate} />
        </div>
        <p className="mt-1 text-sm text-gray-500">Closed — set this in Settings &gt; Operating Hours</p>

        {dayAppointments.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {dayAppointments.map((appt) => (
              <li
                key={appt.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600"
              >
                <span className="font-medium">{clientNameFor(appt.client)}</span>
                <span>{minutesToLabel(minutesSinceMidnight(new Date(appt.datetime)))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-400">
            Closed all day — nothing to book.
          </div>
        )}
      </div>
    );
  }

  // Open day: the grid's range comes straight from Operating Hours,
  // widened only to cover an existing appointment that falls outside
  // it (e.g. hours were tightened after something was already booked)
  // — never widened past that just to leave extra clickable space.
  let rangeStart = timeToMinutes(businessHour.open_time ?? "09:00:00");
  let rangeEnd = timeToMinutes(businessHour.close_time ?? "17:00:00");
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
        <DayNav date={date} setDate={setDate} />
        <Button onClick={() => setAddFormTime(addFormTime === null ? minutesToHHMM(rangeStart) : null)}>
          {addFormTime !== null ? "Cancel" : "Add appointment"}
        </Button>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        Open {minutesToLabel(rangeStart)} – {minutesToLabel(rangeEnd)} · click an open slot below to book it
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

      {/* The time grid itself, as two clearly bordered columns rather
          than everything layered on top of each other: a fixed-width
          label gutter on the left (its own border-right draws the line
          separating "times" from "layout"), and the actual slot
          grid + appointment blocks on the right. Keeping labels in
          their own column — instead of padding them into the same
          space appointment blocks start from — is also what stops a
          block from ever visually swallowing the time next to it. */}
      <div
        className="mt-4 flex overflow-hidden rounded-md border border-gray-300 select-none"
        style={{ height: slots.length * SLOT_HEIGHT_PX }}
      >
        <div className="relative w-16 shrink-0 bg-gray-50">
          {/* Each label sits in its own 30-minute-tall row (flex-centered,
              not floated text with a translate hack) — that's what keeps
              every label lined up evenly regardless of whether it wraps.
              A border-t on every row also gives the gutter its own
              separator lines, matching the ones in the schedule column
              next to it exactly, mark for mark. */}
          {slots
            .filter((minutes) => minutes % 30 === 0)
            .map((minutes) => (
              <div
                key={minutes}
                className="absolute inset-x-0 flex items-center justify-end whitespace-nowrap border-t border-gray-300 pr-2 text-[11px] font-medium text-gray-500"
                style={{
                  top: ((minutes - rangeStart) / SLOT_MINUTES) * SLOT_HEIGHT_PX,
                  height: SLOT_HEIGHT_PX * 2,
                }}
              >
                {minutesToLabel(minutes)}
              </div>
            ))}
        </div>
        <div className="w-px shrink-0 bg-gray-300" />{/* the actual divider between the time gutter and the schedule — a real element, not just a border, so it never gets clipped by rounded corners or antialiasing the way a border sometimes can */}

        <div className="relative flex-1">
          {slots.map((minutes) => {
            const isHourOrHalf = minutes % 30 === 0;
            return (
              <button
                key={minutes}
                onClick={() => setAddFormTime(minutesToHHMM(minutes))}
                className={`absolute inset-x-0 hover:bg-emerald-50/60 ${
                  isHourOrHalf ? "border-t border-gray-200" : "border-t border-dashed border-gray-100"
                }`}
                style={{ top: ((minutes - rangeStart) / SLOT_MINUTES) * SLOT_HEIGHT_PX, height: SLOT_HEIGHT_PX }}
              />
            );
          })}

          {dayAppointments.map((appt) => {
            const start = minutesSinceMidnight(new Date(appt.datetime));
            const top = (start - rangeStart) * (SLOT_HEIGHT_PX / SLOT_MINUTES);
            const height = Math.max(appt.duration_minutes * (SLOT_HEIGHT_PX / SLOT_MINUTES), SLOT_HEIGHT_PX * 0.8);
            return (
              <div
                key={appt.id}
                className="absolute left-1 right-1 overflow-hidden rounded-md border border-emerald-700 bg-emerald-500 px-2 py-1 text-xs text-white shadow-sm"
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
    </div>
  );
}
