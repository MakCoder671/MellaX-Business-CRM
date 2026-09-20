import type { Appointment, BusinessHour, Client } from "./types";

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
  return clients.find((c) => c.id === clientId)?.name ?? "Client";
}

export function isClosedDay(hours: BusinessHour[], date: Date) {
  const businessHour = hours.find((h) => toJsDayOfWeek(h.day_of_week) === date.getDay());
  return !(businessHour?.is_open ?? false);
}

export function businessHoursFor(hours: BusinessHour[], date: Date) {
  return hours.find((h) => toJsDayOfWeek(h.day_of_week) === date.getDay()) ?? null;
}

export function appointmentsOn(appointments: Appointment[], date: Date) {
  return appointments
    .filter((a) => sameDay(new Date(a.datetime), date))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}
