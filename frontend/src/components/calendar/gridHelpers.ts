// ----------------------------------------------------------------------------
// The time-axis math shared by DayView and WeekView — both draw the same
// kind of vertical timeline (15-minute slots, a line every 30 minutes),
// just DayView is one column of it and WeekView is seven side by side.
// Pulled out here once both views needed it, instead of copy-pasting the
// same minute/pixel conversions into a second file.
// ----------------------------------------------------------------------------

export const SLOT_MINUTES = 15;
export const SLOT_HEIGHT_PX = 22;

export function timeToMinutes(hhmmss: string) {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

export function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function minutesToLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function minutesToHHMM(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Rounds down/up to the nearest 15-minute mark, so a grid's range always
// lines up cleanly with the slot lines even when something starts or
// ends at an odd time.
export function floorTo15(minutes: number) {
  return Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}
export function ceilTo15(minutes: number) {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

// Pixel offset from the top of the grid for a given minute-of-day, given
// where the grid's own range starts.
export function minutesToPx(minutes: number, rangeStart: number) {
  return ((minutes - rangeStart) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}
