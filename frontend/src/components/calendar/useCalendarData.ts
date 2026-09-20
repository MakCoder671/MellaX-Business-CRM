import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

import type { Appointment, BusinessHour, Client } from "./types";

// ----------------------------------------------------------------------------
// All three calendar views (Month/Week/Day) need the exact same data:
// the account's one default calendar, its Operating Hours, every
// appointment on it, and the client list (to turn a client ID into a
// name). Fetching that once here — instead of each view doing its own
// fetch — means switching views doesn't re-request everything from
// scratch, and there's exactly one place that knows how to refresh the
// appointment list after something changes.
// ----------------------------------------------------------------------------

export function useCalendarData() {
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [hours, setHours] = useState<BusinessHour[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const loadAppointments = useCallback((forCalendarId: number) => {
    apiFetch<Appointment[]>(`/api/scheduling/appointments/?calendar=${forCalendarId}`).then(setAppointments);
  }, []);

  useEffect(() => {
    apiFetch<{ id: number }>("/api/scheduling/calendars/default/").then((cal) => {
      setCalendarId(cal.id);
      loadAppointments(cal.id);
    });
    apiFetch<BusinessHour[]>("/api/scheduling/business-hours/").then(setHours);
    apiFetch<Client[]>("/api/clients/").then(setClients);
  }, [loadAppointments]);

  const refresh = useCallback(() => {
    if (calendarId !== null) loadAppointments(calendarId);
  }, [calendarId, loadAppointments]);

  return {
    calendarId,
    hours,
    appointments,
    clients,
    loading: hours === null || appointments === null || calendarId === null,
    refresh,
  };
}
