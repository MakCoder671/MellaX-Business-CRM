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

export type Client = { id: number; full_name: string };

export type Service = { id: number; name: string };

export type AppointmentHistoryEntry = {
  id: number;
  change_description: string;
  changed_at: string;
};

export type Appointment = {
  id: number;
  client: number;
  service: number | null;
  datetime: string; // ISO datetime string
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string;
  recurrence_id: string | null; // shared by every appointment generated from the same "repeat weekly/biweekly/monthly" booking, null for a one-off
  history: AppointmentHistoryEntry[];
};
