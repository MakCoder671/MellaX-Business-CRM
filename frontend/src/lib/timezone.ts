import { formatInTimeZone as formatInTimeZoneBase, fromZonedTime, toZonedTime } from "date-fns-tz";

// ----------------------------------------------------------------------------
// Every date the calendar touches (booking, the time grid, business hours,
// "is today closed") used to just read whatever the VIEWING BROWSER's own
// local clock said — correct only by coincidence, when the device happens to
// sit in the same timezone as the business. These two functions are the
// only place that conversion math lives, built on date-fns-tz (which in
// turn uses the browser's own Intl API — real IANA tz data, DST included,
// no separate timezone database to ship or keep updated):
//
//   - zonedTimeToUtc: someone TYPED a wall-clock time meaning "this is our
//     business's local time" (booking an appointment) — convert that to the
//     real UTC instant the backend should store.
//   - utcToZonedParts: the backend sent back a UTC instant (an existing
//     appointment) — break it into the wall-clock Y-M-D/H:M the business
//     would actually see on their own clock, not whatever the viewer's
//     device clock happens to read.
//
// Every place that used to call .getHours()/.getDay()/.toDateString() etc
// directly on an appointment or business-hours Date now goes through one of
// these instead, with the business's timeZone (account.time_zone) passed
// in explicitly rather than trusted implicitly.
// ----------------------------------------------------------------------------

export function zonedTimeToUtc(
  year: number,
  month: number, // 1-indexed (January = 1), matching how callers already think about dates
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  // A plain `new Date(...)` reads these numbers using whatever timezone
  // the CURRENT device happens to be in — fromZonedTime doesn't care what
  // that device zone actually is, it just reads the wall-clock fields back
  // off the Date (year/month/day/hour/minute) and treats THOSE as the
  // intended local time in `timeZone`. That's exactly what's wanted here:
  // the numbers are what matters, not which zone constructed them.
  const naive = new Date(year, month - 1, day, hour, minute, 0, 0);
  return fromZonedTime(naive, timeZone);
}

export type ZonedParts = {
  year: number;
  month: number; // 1-indexed
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sunday..6=Saturday, matches Date.getDay()
};

export function utcToZonedParts(date: Date, timeZone: string): ZonedParts {
  // toZonedTime shifts the Date so the SYSTEM's own local getters
  // (.getFullYear(), .getHours(), ...) report the wall-clock time in
  // `timeZone`, regardless of what zone the device itself is actually in.
  const zoned = toZonedTime(date, timeZone);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    dayOfWeek: zoned.getDay(),
  };
}

// date-fns format tokens (not Intl's) — e.g. "h:mm a" -> "2:30 PM",
// "EEEE, MMMM d" -> "Friday, October 2". Used for anything shown ON the
// calendar (time grid labels, date headers), which needs to reflect the
// business's zone specifically, not the viewer's own locale/zone the way
// toLocaleString() would.
export function formatInTimeZone(date: Date, timeZone: string, formatString: string): string {
  return formatInTimeZoneBase(date, timeZone, formatString);
}
