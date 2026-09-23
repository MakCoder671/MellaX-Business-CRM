"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

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
import {
  appointmentBlockClasses,
  appointmentsOn,
  appointmentTextTier,
  businessHoursFor,
  isNoShow,
  serviceName,
  startOfWeek,
} from "./helpers";
import type { Appointment, BusinessHour, Client, Service } from "./types";

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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [addForm, setAddForm] = useState<AddFormTarget>(null);

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  function clientNameFor(clientId: number) {
    return clients.find((c) => c.id === clientId)?.full_name ?? "Client";
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
          className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
        >
          ←
        </button>
        <h3 className="text-base font-medium">{weekLabel}</h3>
        <button
          onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
          className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
        >
          →
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
        >
          Today
        </button>
      </div>

      {addForm && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-gray-500">
            {addForm.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <AddAppointmentForm
            key={`${addForm.date.toDateString()}-${addForm.time}`} // remounts with fresh values whenever a different day/slot is clicked
            calendarId={calendarId}
            clients={clients}
            services={services}
            date={addForm.date}
            initialTime={addForm.time}
            onClientAdded={onClientAdded}
            onDone={() => {
              setAddForm(null);
              onChanged();
            }}
          />
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-md border border-[var(--cal-600,#059669)]/25 select-none">
        {/* Day-name header row — same gutter width + divider as the body
            below, so the day columns line up exactly with their names. */}
        <div className="flex border-b border-[var(--cal-600,#059669)]/25 bg-[var(--cal-50,#ecfdf5)]">
          <div className="w-16 shrink-0" />
          <div className="w-px shrink-0 bg-[var(--cal-600,#059669)]/25" />
          {days.map((date) => {
            const isToday = date.toDateString() === today.toDateString();
            return (
              <div
                key={date.toDateString()}
                className={`flex-1 border-r border-[var(--cal-600,#059669)]/15 py-1.5 text-center text-xs font-medium last:border-r-0 ${
                  isToday ? "bg-[var(--cal-100,#d1fae5)] text-[var(--cal-700,#047857)]" : "text-gray-600"
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
          <div className="relative w-16 shrink-0 bg-[var(--cal-50,#ecfdf5)]">
            {slots
              .filter((minutes) => minutes % 30 === 0)
              .map((minutes) => (
                <div
                  key={minutes}
                  className="absolute inset-x-0 flex items-center justify-end whitespace-nowrap border-t border-[var(--cal-600,#059669)]/25 pr-2 text-[11px] font-medium text-gray-500"
                  style={{ top: minutesToPx(minutes, rangeStart), height: SLOT_HEIGHT_PX * 2 }}
                >
                  {minutesToLabel(minutes)}
                </div>
              ))}
          </div>
          <div className="w-px shrink-0 bg-[var(--cal-600,#059669)]/25" />

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
                className={`relative flex-1 border-r border-[var(--cal-600,#059669)]/15 last:border-r-0 ${isToday ? "bg-[var(--cal-50,#ecfdf5)]/30" : ""}`}
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
                          className={`absolute inset-x-0 hover:bg-[var(--cal-50,#ecfdf5)]/60 ${
                            isHourOrHalf
                              ? "border-t border-[var(--cal-600,#059669)]/15"
                              : "border-t border-dashed border-[var(--cal-600,#059669)]/8"
                          }`}
                          style={{ top: minutesToPx(minutes, rangeStart), height: SLOT_HEIGHT_PX }}
                        />
                      );
                    })}

                    {dayAppointments.map((appt, index) => {
                      const start = minutesSinceMidnight(new Date(appt.datetime));
                      const top = minutesToPx(start, rangeStart);
                      const height = Math.max(appt.duration_minutes * (SLOT_HEIGHT_PX / SLOT_MINUTES), SLOT_HEIGHT_PX * 0.8);
                      const alternate = index % 2 === 1;
                      const service = serviceName(services, appt.service);
                      const noShow = isNoShow(appt.status);
                      const name = clientNameFor(appt.client);
                      // Same idea as DayView's tiers - a week column's
                      // block height is just as duration-proportional as
                      // a day column's, so a 15-minute appointment here
                      // is exactly as short on room. A week column is
                      // narrow regardless of duration though, so there's
                      // no "spacious" 3-line case here the way DayView
                      // has - just tight (1 line) vs everything else
                      // (name bold + service tag on their own two lines).
                      const tier = appointmentTextTier(appt.duration_minutes);
                      return (
                        <button
                          key={appt.id}
                          onClick={() => onSelectAppointment(appt)}
                          className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-1 py-0.5 text-left leading-tight shadow-sm ${appointmentBlockClasses(appt.status, alternate)}`}
                          style={{ top: top + 1, height: Math.max(height - 2, 4) }}
                        >
                          {tier === "tight" ? (
                            <p className="flex items-center gap-1 truncate text-[9px] font-bold">
                              {noShow && <AlertTriangle className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />}
                              <span className="truncate">{name}</span>
                              {service && <span className="truncate font-normal opacity-90">· {service}</span>}
                            </p>
                          ) : (
                            <div className="space-y-0.5">
                              <p
                                className={`flex items-center gap-1 truncate font-bold ${tier === "spacious" ? "text-[11px]" : "text-[10px]"}`}
                              >
                                {noShow && <AlertTriangle className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />}
                                <span className="truncate">{name}</span>
                              </p>
                              {service && (
                                <span className="inline-block max-w-full truncate rounded-full bg-white/25 px-1.5 py-px text-[8px] font-semibold cal-block-text">
                                  {service}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
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
