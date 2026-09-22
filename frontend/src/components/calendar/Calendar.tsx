"use client";

import { useState } from "react";

import { Card } from "@/components/form";
import { useAuth } from "@/lib/auth-context";

import { AppointmentOverview } from "./AppointmentOverview";
import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import type { Appointment } from "./types";
import { useCalendarData } from "./useCalendarData";
import { WeekView } from "./WeekView";

// ----------------------------------------------------------------------------
// The calendar widget on the dashboard Overview page. Three interchangeable
// views over the same underlying data (fetched once by useCalendarData,
// shared by whichever view is active):
//   - Month: a density overview (a real wall-calendar grid)
//   - Week: an agenda list, one section per day, nothing hidden
//   - Day: the fullest detail, one day at a time
//
// Per Mako's feedback: Month is fine as a compact overview, but people
// also want to see everything without anything capped/hidden — that's
// what Week and Day are for.
//
// Which one shows FIRST is a per-account preference (Settings > Calendar
// > Default calendar view) — read once as the initial state below. The
// toggle still switches freely between all three any time; this only
// decides where the widget starts.
// ----------------------------------------------------------------------------

type ViewMode = "day" | "week" | "month";

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export function Calendar() {
  const { account } = useAuth();
  const [view, setView] = useState<ViewMode>(() => account?.default_calendar_view ?? "month");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { calendarId, hours, appointments, clients, services, loading, refresh, refreshClients } = useCalendarData();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Calendar</h2>
        {/* A segmented button group, like Month/Week/Day toggles in any
            other calendar app — switching views keeps the same
            underlying data, just displayed differently. */}
        <div className="flex rounded-md border border-[var(--cal-600,#059669)]/25 p-0.5 text-sm">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`rounded px-3 py-1 ${
                view === mode ? "cal-accent-bg" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {/* Checking each value individually (not just the `loading`
            flag) is what lets TypeScript narrow hours/appointments from
            "T[] | null" to plain "T[]" for everything below — `loading`
            alone is a separate boolean and doesn't prove these aren't
            null as far as the type-checker is concerned. */}
        {loading || calendarId === null || hours === null || appointments === null ? (
          <p className="text-sm text-gray-500">Loading calendar…</p>
        ) : (
          <>
            {view === "day" && (
              <DayView
                calendarId={calendarId}
                hours={hours}
                appointments={appointments}
                clients={clients}
                services={services}
                onChanged={refresh}
                onClientAdded={refreshClients}
                onSelectAppointment={setSelectedAppointment}
              />
            )}
            {view === "week" && (
              <WeekView
                calendarId={calendarId}
                hours={hours}
                appointments={appointments}
                clients={clients}
                services={services}
                onChanged={refresh}
                onClientAdded={refreshClients}
                onSelectAppointment={setSelectedAppointment}
              />
            )}
            {view === "month" && (
              <MonthView
                calendarId={calendarId}
                hours={hours}
                appointments={appointments}
                clients={clients}
                services={services}
                onChanged={refresh}
                onClientAdded={refreshClients}
                onSelectAppointment={setSelectedAppointment}
              />
            )}
          </>
        )}
      </div>

      {selectedAppointment && (
        <AppointmentOverview
          appointment={selectedAppointment}
          clients={clients}
          services={services}
          onClose={() => setSelectedAppointment(null)}
          onChanged={refresh}
        />
      )}
    </Card>
  );
}
