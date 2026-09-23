"use client";

import { useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";

import { Button } from "@/components/form";

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
  formatDuration,
  isNoShow,
  serviceName,
} from "./helpers";
import type { Appointment, BusinessHour, Client, Service } from "./types";

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
        className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
      >
        ←
      </button>
      <h3 className="text-base font-medium">
        {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </h3>
      <button
        onClick={() => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
        className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
      >
        →
      </button>
      <button
        onClick={() => setDate(new Date())}
        className="rounded-md border border-[var(--cal-600,#059669)]/25 px-2 py-1 text-sm text-gray-600 hover:bg-[var(--cal-50,#ecfdf5)]"
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
  const [date, setDate] = useState(() => new Date());
  const [addFormTime, setAddFormTime] = useState<string | null>(null); // "HH:MM" of the slot last clicked, or null when the form's closed

  const dayAppointments = appointmentsOn(appointments, date);
  const businessHour = businessHoursFor(hours, date);

  function clientNameFor(clientId: number) {
    return clients.find((c) => c.id === clientId)?.full_name ?? "Client";
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
              <li key={appt.id}>
                <button
                  onClick={() => onSelectAppointment(appt)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {isNoShow(appt.status) && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" strokeWidth={2.5} />
                    )}
                    {clientNameFor(appt.client)}
                  </span>
                  <span>{minutesToLabel(minutesSinceMidnight(new Date(appt.datetime)))}</span>
                </button>
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

  const slots: number[] = [];
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
        <div className="mt-3">
          <AddAppointmentForm
            key={addFormTime} // remounts with a fresh initial time whenever a different slot is clicked — see the note in AddAppointmentForm.tsx
            calendarId={calendarId}
            clients={clients}
            services={services}
            date={date}
            initialTime={addFormTime}
            onClientAdded={onClientAdded}
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
        className="mt-4 flex overflow-hidden rounded-md border border-[var(--cal-600,#059669)]/25 select-none"
        style={{ height: slots.length * SLOT_HEIGHT_PX }}
      >
        <div className="relative w-16 shrink-0 bg-[var(--cal-50,#ecfdf5)]">
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
                className="absolute inset-x-0 flex items-center justify-end whitespace-nowrap border-t border-[var(--cal-600,#059669)]/25 pr-2 text-[11px] font-medium text-gray-500"
                style={{
                  top: minutesToPx(minutes, rangeStart),
                  height: SLOT_HEIGHT_PX * 2,
                }}
              >
                {minutesToLabel(minutes)}
              </div>
            ))}
        </div>
        <div className="w-px shrink-0 bg-[var(--cal-600,#059669)]/25" />{/* the actual divider between the time gutter and the schedule — a real element, not just a border, so it never gets clipped by rounded corners or antialiasing the way a border sometimes can */}

        <div className="relative flex-1">
          {slots.map((minutes) => {
            const isHourOrHalf = minutes % 30 === 0;
            return (
              <button
                key={minutes}
                onClick={() => setAddFormTime(minutesToHHMM(minutes))}
                className={`absolute inset-x-0 hover:bg-[var(--cal-50,#ecfdf5)]/60 ${
                  isHourOrHalf ? "border-t border-[var(--cal-600,#059669)]/15" : "border-t border-dashed border-[var(--cal-600,#059669)]/8"
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
            const time = minutesToLabel(start);
            // Name, service, and duration each get their own line, sized
            // like a small heading on top (not a literal <h2>/<h3> — these
            // buttons sit inside a calendar grid, not page structure, and
            // one per appointment would wreck screen-reader heading
            // navigation) - but ONLY when the block is actually tall
            // enough for that. A block's height is a direct function of
            // the appointment's duration (see gridHelpers.ts), so a
            // 15-minute appointment simply doesn't have the room a
            // 60-minute one does - rather than sizing for the tall case
            // and letting overflow-hidden silently clip whatever doesn't
            // fit on a short one, the tier picks smaller text and fewer,
            // combined lines so everything stays visible either way.
            const tier = appointmentTextTier(appt.duration_minutes);
            // The service now reads as a small tag (a translucent pill
            // against the block's own color) rather than plain inline
            // text after a "·" — it's a distinct piece of information
            // (WHAT this booking is) from the client's name (WHO it's
            // for), so it gets its own visual treatment instead of
            // reading as one run-on sentence.
            const servicePill = service && (
              <span className="inline-block max-w-full truncate rounded-full bg-white/25 px-1.5 py-px text-[9px] font-semibold leading-tight cal-block-text">
                {service}
              </span>
            );
            const nameLine = (textSize: string) => (
              <p className={`flex items-center gap-1 truncate font-bold leading-tight ${textSize}`}>
                {noShow && <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
                <span className="truncate">{name}</span>
              </p>
            );
            return (
              <button
                key={appt.id}
                onClick={() => onSelectAppointment(appt)}
                className={`absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm ${appointmentBlockClasses(appt.status, alternate)}`}
                style={{ top: top + 1, height: Math.max(height - 2, 4) }}
              >
                {tier === "tight" ? (
                  <p className="flex items-center gap-1 truncate text-[10px] font-bold leading-tight">
                    {noShow && <AlertTriangle className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />}
                    <span className="truncate">{name}</span>
                    {service && <span className="truncate font-normal opacity-90">· {service}</span>}
                  </p>
                ) : tier === "compact" ? (
                  <>
                    {nameLine("text-xs")}
                    <p className="truncate text-[10px] leading-tight opacity-90">
                      {service ? `${service} · ` : ""}
                      {formatDuration(appt.duration_minutes)}
                    </p>
                  </>
                ) : tier === "cozy" ? (
                  <div className="space-y-0.5">
                    {nameLine("text-xs")}
                    {servicePill}
                    <p className="flex items-center gap-1 truncate text-[10px] leading-tight opacity-90">
                      <Clock className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                      {time} · {formatDuration(appt.duration_minutes)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {nameLine("text-sm sm:text-base")}
                    {servicePill}
                    <p className="flex items-center gap-1 truncate text-xs leading-tight opacity-90">
                      <Clock className="h-3 w-3 shrink-0" strokeWidth={2} />
                      {time} · {formatDuration(appt.duration_minutes)}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
