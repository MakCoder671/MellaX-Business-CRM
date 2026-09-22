import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

import type { Appointment, BusinessHour, Client, Service } from "./types";

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
  const [services, setServices] = useState<Service[]>([]);

  const loadAppointments = useCallback((forCalendarId: number) => {
    apiFetch<Appointment[]>(`/api/scheduling/appointments/?calendar=${forCalendarId}`).then(setAppointments);
  }, []);

  const loadClients = useCallback(() => {
    apiFetch<Client[]>("/api/clients/").then(setClients);
  }, []);

  useEffect(() => {
    apiFetch<{ id: number }>("/api/scheduling/calendars/default/").then((cal) => {
      setCalendarId(cal.id);
      loadAppointments(cal.id);
    });
    apiFetch<BusinessHour[]>("/api/scheduling/business-hours/").then(setHours);
    loadClients();
    apiFetch<Service[]>("/api/services/").then(setServices);
  }, [loadAppointments, loadClients]);

  const refresh = useCallback(() => {
    if (calendarId !== null) loadAppointments(calendarId);
  }, [calendarId, loadAppointments]);

  return {
    calendarId,
    hours,
    appointments,
    clients,
    services,
    loading: hours === null || appointments === null || calendarId === null,
    refresh,
    // Booking an appointment for a walk-in who isn't a client yet can
    // create the client right there in the same form (see
    // AddAppointmentForm's "+ New client" toggle) - this is what lets
    // that new client actually show up in the picker for the NEXT
    // appointment booked, without a full page reload.
    refreshClients: loadClients,
  };
}
