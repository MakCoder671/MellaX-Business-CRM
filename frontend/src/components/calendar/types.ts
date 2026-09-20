// ----------------------------------------------------------------------------
// Shared shapes for every calendar view (Month/Week/Day) — one source of
// truth so MonthView, WeekView, and DayView can't quietly drift out of
// sync with what the backend actually sends.
// ----------------------------------------------------------------------------

export type BusinessHour = {
  day_of_week: number; // 0=Monday ... 6=Sunday, see scheduling/models.py
  open_time: string | null;
  close_time: string | null;
  is_open: boolean;
};

export type Client = { id: number; name: string };

export type Appointment = {
  id: number;
  client: number;
  datetime: string; // ISO datetime string
  status: "scheduled" | "completed" | "cancelled";
};
