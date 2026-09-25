import { minutesSinceMidnight } from "./gridHelpers";
import type { Appointment, BusinessHour, Client, Service } from "./types";

// ----------------------------------------------------------------------------
// Small, pure date/lookup helpers shared by every calendar view. Kept as
// plain functions (not methods on a class or bundled into the data hook)
// since none of them need any state of their own — just inputs to
// outputs, easy to reuse anywhere.
// ----------------------------------------------------------------------------

// Converts our Monday=0..Sunday=6 day-of-week convention (matching the
// backend) into JavaScript's native Sunday=0..Saturday=6 Date.getDay()
// convention, so the two can be compared directly.
export function toJsDayOfWeek(backendDayOfWeek: number) {
  return (backendDayOfWeek + 1) % 7;
}

export function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Formats a business-hours time string ("14:00:00", straight from the
// backend) rather than a Date object — e.g. "2:00 PM". A separate
// function from formatTime() above since the two take different inputs.
export function formatHourString(hhmmss: string) {
  const [hours, minutes] = hhmmss.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function clientName(clients: Client[], clientId: number) {
  return clients.find((c) => c.id === clientId)?.full_name ?? "Client";
}

// Per Mako: seeing just "Test MX at 9:30" on the calendar doesn't say
// WHAT the appointment actually is - showing the service name right on
// the block/chip means that's visible at a glance, not just after
// clicking in. Returns null (not a placeholder string) when there's no
// service on the appointment or it can't be found, so callers can leave
// it out entirely rather than showing something like "· null".
export function serviceName(services: Service[], serviceId: number | null) {
  if (serviceId === null) return null;
  return services.find((s) => s.id === serviceId)?.name ?? null;
}

// How much room an appointment's block actually gets on the Day/Week
// time grid is entirely a function of its duration (the block's height
// is directly proportional to it — see gridHelpers.ts) - a 15-minute
// appointment's block is only ~20px tall, a 60-minute one is ~86px.
// Per Mako: text sized for the 60-minute case just gets silently
// clipped on a 15 or 30-minute one instead of actually fitting - the
// fix is picking a smaller, more compact text tier for short
// appointments instead of shrinking-via-clipping. Duration is known at
// render time, so this is a straight lookup, not a runtime measurement.
export type AppointmentTextTier = "tight" | "compact" | "cozy" | "spacious";

export function appointmentTextTier(durationMinutes: number): AppointmentTextTier {
  if (durationMinutes <= 15) return "tight";
  if (durationMinutes <= 30) return "compact";
  if (durationMinutes <= 45) return "cozy";
  return "spacious";
}

export function isClosedDay(hours: BusinessHour[], date: Date) {
  const businessHour = hours.find((h) => toJsDayOfWeek(h.day_of_week) === date.getDay());
  return !(businessHour?.is_open ?? false);
}

export function businessHoursFor(hours: BusinessHour[], date: Date) {
  return hours.find((h) => toJsDayOfWeek(h.day_of_week) === date.getDay()) ?? null;
}

export function appointmentsOn(appointments: Appointment[], date: Date) {
  // Cancelled appointments come out of the calendar entirely — per
  // Mako, they still live on the client's profile (the Appointments tab
  // shows every appointment, cancelled included, via its own separate
  // fetch), but the calendar itself should only show what's actually
  // happening. No Show stays visible here on purpose — see
  // appointmentBlockClasses/appointmentChipClasses below for how it's
  // marked instead of hidden.
  return appointments
    .filter((a) => a.status !== "cancelled" && sameDay(new Date(a.datetime), date))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

// Every duration an appointment can be booked for — 15 minutes up
// through a full 8-hour day, every 15 minutes the whole way (not just
// up to the 1-hour mark and then jumping to half-hour steps) - some
// businesses run all-day jobs (a full deck build, a whole-house
// cleaning), so this goes well past the usual "hour or two" appointment
// length rather than capping out early, and a job that runs long
// shouldn't have to round up/down to the nearest half hour to book it.
export const DURATION_OPTIONS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15);

// "90 min" doesn't read as quickly as "1 hour 30 min" once you're past
// an hour - this used to only convert EXACT hour counts (60, 120, ...)
// and fall back to raw minutes for anything in between (90, 150, ...),
// which was most of DURATION_OPTIONS above. Every value now gets the
// same "X hour(s) [Y min]" treatment.
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const hourPart = `${hours} hour${hours > 1 ? "s" : ""}`;
  return remainder === 0 ? hourPart : `${hourPart} ${remainder} min`;
}

export const STATUS_LABELS: Record<Appointment["status"], string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export function statusBadgeClass(status: Appointment["status"]) {
  const base = "inline-block rounded-full px-2 py-0.5 text-xs font-medium";
  switch (status) {
    case "completed":
      return `${base} bg-emerald-100 text-emerald-700`;
    case "cancelled":
      return `${base} bg-gray-100 text-gray-700`;
    case "no_show":
      return `${base} bg-red-100 text-red-700`;
    default:
      return `${base} bg-blue-100 text-blue-700`;
  }
}

// A No Show stays ON the calendar (unlike Cancelled, which is filtered
// out entirely by appointmentsOn above) but needs to visually stand out
// from a normal booked appointment — these two give every calendar
// view's appointment block/chip a distinct red color plus a warning
// icon for that one status, regardless of the calendar's color preset.
// No Show is deliberately NOT themeable — it's a warning state, and
// letting it get reassigned away from red would defeat the point of it
// standing out. Every other status uses the Settings > Calendar color
// preset (see themePresets.ts) via CSS custom properties.
//
// `alternate` — per Mako, two back-to-back appointments (say, a 9:00 and
// a 10:00, each an hour long) sit flush against each other on the
// Day/Week grid with nothing but a thin same-colored border between
// them, and can visually read as ONE 2-hour appointment. Passing
// `alternate` (every other appointment in a day's list, by array index —
// see DayView/WeekView) shifts to a visibly different shade of the SAME
// color family, so consecutive bookings are obviously separate blocks at
// a glance even when they're touching in time. Combined with the small
// gap DayView/WeekView also add between blocks.
export function appointmentBlockClasses(status: Appointment["status"], alternate = false) {
  // text color is part of these classes (not hardcoded text-white on the
  // block itself) since a preset like Amber needs dark text to stay
  // readable - see onColor in themePresets.ts. cal-block-text (see
  // globals.css) adds a soft halo behind that text so it stays legible
  // regardless of exactly which color/gradient ends up behind it, not
  // just the one shade onColor was picked against.
  if (status === "no_show") return "border-red-700 bg-red-500 hover:bg-red-600 text-white cal-block-text";
  return alternate
    ? "border-[var(--cal-800,#065f46)] bg-[var(--cal-600,#059669)] hover:bg-[var(--cal-700,#047857)] text-[var(--cal-on,#ffffff)] cal-block-text"
    : "border-[var(--cal-700,#047857)] bg-[var(--cal-500,#10b981)] hover:bg-[var(--cal-600,#059669)] text-[var(--cal-on,#ffffff)] cal-block-text";
}

export function appointmentChipClasses(status: Appointment["status"], alternate = false) {
  if (status === "no_show") return "bg-red-100 text-red-800 hover:bg-red-200";
  return alternate
    ? "bg-[var(--cal-300,#6ee7b7)] text-[var(--cal-800,#065f46)] hover:bg-[var(--cal-500,#10b981)]"
    : "bg-[var(--cal-100,#d1fae5)] text-[var(--cal-800,#065f46)] hover:bg-[var(--cal-300,#6ee7b7)]";
}

// Two appointments that genuinely OVERLAP in time (as opposed to just
// sitting back-to-back — see appointmentBlockClasses' `alternate` for
// that, unrelated case) used to both render as full-width blocks on the
// Day/Week time grid, meaning whichever one came later in the array
// simply painted on top of and hid the earlier one for however long they
// overlapped. This only comes up when double-booking is allowed
// (Settings > Calendar > Booking Rules) or an appointment runs long
// enough to bump into the next one's start time, but when it does, a
// client's entire booking could silently disappear behind another one.
//
// Fix: appointments that overlap get their own side-by-side column
// instead, the same way Google/Apple Calendar lay out a double-booked
// slot. A classic calendar-layout sweep — walk appointments in start-time
// order, track which columns are still "occupied" (their appointment
// hasn't ended yet) at the current point, and hand each new appointment
// the lowest column number nothing else currently occupies. Appointments
// that all connect through overlaps (A overlaps B, B overlaps C, even if
// A and C don't directly touch) share the same totalColumns width, so
// the whole connected group reads as one consistent split instead of
// each pair computing its own — a lone appointment with nothing else
// anywhere near it still just gets column 0 of 1 (full width, unchanged
// from before this existed).
export type AppointmentLayout = { appointment: Appointment; column: number; totalColumns: number };

export function layoutOverlaps(appointments: Appointment[]): AppointmentLayout[] {
  const sorted = [...appointments].sort(
    (a, b) => minutesSinceMidnight(new Date(a.datetime)) - minutesSinceMidnight(new Date(b.datetime))
  );

  type Placed = { appointment: Appointment; column: number; end: number };
  const results: AppointmentLayout[] = [];
  let active: Placed[] = []; // still-open appointments in the CURRENT cluster
  let cluster: Placed[] = []; // every appointment placed in the current cluster so far

  function flushCluster() {
    if (cluster.length === 0) return;
    const totalColumns = Math.max(...cluster.map((p) => p.column)) + 1;
    for (const p of cluster) results.push({ appointment: p.appointment, column: p.column, totalColumns });
    cluster = [];
  }

  for (const appointment of sorted) {
    const start = minutesSinceMidnight(new Date(appointment.datetime));
    const end = start + appointment.duration_minutes;

    active = active.filter((p) => p.end > start);
    // The previous cluster has fully ended before this appointment even
    // starts (nothing still active) — safe to finalize its width and
    // move on, rather than letting one busy morning force every
    // appointment for the rest of the day to share its column count.
    if (active.length === 0) flushCluster();

    const usedColumns = new Set(active.map((p) => p.column));
    let column = 0;
    while (usedColumns.has(column)) column++;

    const placed: Placed = { appointment, column, end };
    active.push(placed);
    cluster.push(placed);
  }
  flushCluster();

  return results;
}

// A plain boolean rather than a rendered icon/glyph — helpers.ts is a
// .ts file with no JSX, so the actual <AlertTriangle /> icon each
// calendar view shows for a No Show is rendered there directly; this
// just answers "should that icon show up at all" from one place.
export function isNoShow(status: Appointment["status"]) {
  return status === "no_show";
}
