"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText } from "@/components/form";
import { CreateInvoiceModal } from "@/components/invoicing/CreateInvoiceModal";

import { DURATION_OPTIONS, STATUS_LABELS, formatDuration, statusBadgeClass } from "./helpers";
import type { Appointment, Client, Service } from "./types";

// ----------------------------------------------------------------------------
// The panel that pulls up when you click an appointment already on the
// calendar (Day/Week/Month views all open the same one — see Calendar.tsx,
// which owns the "which appointment is selected" state). Shows the
// client's info, the appointment's own details and notes, and the action
// row Mako asked for: Edit, Delete, No Show, Cancel Appt, and Checkout
// (which marks it completed and hands off straight into creating the
// invoice, same flow as the client profile's Appointments tab).
// ----------------------------------------------------------------------------

type FullClient = { id: number; full_name: string; email: string; phone: string; address: string };
type Invoice = { id: number; invoice_number: string; appointment: number | null };

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInputValue(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function AppointmentOverview({
  appointment,
  clients,
  services,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  clients: Client[];
  services: Service[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState(appointment);
  const [fullClient, setFullClient] = useState<FullClient | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [clientId, setClientId] = useState(appointment.client);
  const [serviceId, setServiceId] = useState<number | "">(appointment.service ?? "");
  const [date, setDate] = useState(() => toDateInputValue(new Date(appointment.datetime)));
  const [time, setTime] = useState(() => toTimeInputValue(new Date(appointment.datetime)));
  const [duration, setDuration] = useState(appointment.duration_minutes);
  const [notes, setNotes] = useState(appointment.notes);

  useEffect(() => {
    apiFetch<FullClient>(`/api/clients/${current.client}/`).then(setFullClient);
    apiFetch<Invoice[]>(`/api/invoicing/invoices/?client=${current.client}`).then((invoices) => {
      setInvoice(invoices.find((inv) => inv.appointment === current.id) ?? null);
    });
  }, [current.id, current.client]);

  function serviceName(id: number | null) {
    if (id === null) return "—";
    return services.find((s) => s.id === id)?.name ?? `Service #${id}`;
  }

  async function patchAppointment(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<Appointment>(`/api/scheduling/appointments/${current.id}/`, {
        method: "PATCH",
        body,
      });
      setCurrent(updated);
      onChanged();
      return updated;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this appointment? This can't be undone.")) return;
    await apiFetch(`/api/scheduling/appointments/${current.id}/`, { method: "DELETE" });
    onChanged();
    onClose();
  }

  async function handleCheckout() {
    // Checking out opens the invoice-creation popup right here instead
    // of navigating away to a list of invoices — per Mako, landing on a
    // list full of OTHER (already paid) invoices while trying to bill
    // just this one client was confusing. Only actually flips the
    // appointment to "completed" once there's a real invoice to show
    // for it (see handleInvoiceSaved below).
    setShowInvoiceModal(true);
  }

  async function handleInvoiceSaved() {
    if (current.status !== "completed") {
      await patchAppointment({ status: "completed" });
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const [hh, mm] = time.split(":").map(Number);
    const [yyyy, mo, dd] = date.split("-").map(Number);
    const localDatetime = new Date(yyyy, mo - 1, dd, hh, mm, 0, 0);
    const updated = await patchAppointment({
      client: clientId,
      service: serviceId || null,
      datetime: localDatetime.toISOString(),
      duration_minutes: duration,
      notes,
    });
    if (updated) setEditing(false);
  }

  const clientDisplayName = fullClient?.full_name ?? clients.find((c) => c.id === current.client)?.full_name ?? "Client";

  // Checking out swaps this whole panel for the invoice-creation one,
  // rather than stacking a second popup on top of it. Closing that one
  // (whether they bailed out early or just finished looking at the
  // saved invoice) closes this whole Overview too, back to a refreshed
  // calendar — reopening a now-locked Overview underneath would be odd.
  if (showInvoiceModal) {
    return (
      <CreateInvoiceModal
        clientId={current.client}
        appointmentId={current.id}
        initialServiceId={current.service}
        onSaved={handleInvoiceSaved}
        onClose={() => {
          onChanged();
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Appointment #{current.id}</h2>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {editing ? (
          <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
            <label className="block text-sm">
              Client
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Service
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">None</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Date
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-sm">
                Time
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <label className="block text-sm">
              Duration
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]"
              />
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            <ErrorText>{error}</ErrorText>
          </form>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Client</p>
                <p className="mt-0.5 font-medium text-gray-900">{clientDisplayName}</p>
                <p className="text-gray-500">{fullClient?.email || fullClient?.phone || "—"}</p>
                {fullClient?.address && <p className="text-gray-500">{fullClient.address}</p>}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Appointment</p>
                <p className="mt-0.5 text-gray-900">
                  {new Date(current.datetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="text-gray-500">
                  {formatDuration(current.duration_minutes)} · {serviceName(current.service)}
                </p>
                <p className="mt-1">
                  <span className={statusBadgeClass(current.status)}>{STATUS_LABELS[current.status]}</span>
                </p>
                {current.recurrence_id && <p className="mt-1 text-xs text-gray-400">Part of a recurring series</p>}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {current.notes || "No notes for this appointment."}
              </p>
            </div>

            {invoice && (
              <p className="mt-4 text-xs text-gray-400">
                This appointment has been invoiced. Delete the invoice to make changes to it here.
              </p>
            )}

            <ErrorText>{error}</ErrorText>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
              <div className="flex flex-wrap gap-2">
                {/* Once invoiced, an appointment is locked — no edit,
                    delete, no show, or cancel — until that invoice is
                    deleted (the backend enforces this too; hiding these
                    here just keeps someone from hitting that error). */}
                {!invoice && (
                  <>
                    <Button variant="secondary" onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={handleDelete}>
                      Delete
                    </Button>
                    {current.status === "scheduled" && (
                      <>
                        <Button variant="secondary" onClick={() => patchAppointment({ status: "no_show" })} disabled={busy}>
                          No Show
                        </Button>
                        <Button variant="secondary" onClick={() => patchAppointment({ status: "cancelled" })} disabled={busy}>
                          Cancel Appt
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
              <div>
                {invoice ? (
                  <Link href={`/dashboard/invoices/${invoice.id}`} className="text-sm text-emerald-700 underline">
                    Invoiced #{invoice.invoice_number}
                  </Link>
                ) : current.status === "completed" || current.status === "scheduled" ? (
                  <Button onClick={handleCheckout} disabled={busy}>
                    {current.status === "completed" ? "Create invoice" : "Checkout"}
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
