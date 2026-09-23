"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Clock,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { CreateInvoiceModal } from "@/components/invoicing/CreateInvoiceModal";

// ----------------------------------------------------------------------------
// A client's full profile: their info on the left (view mode, with an
// Edit toggle to change it or add an address), and a tabbed panel on the
// right covering Purchases, Documents, Appointments, and Notes — per
// Mako's spec for what a client's profile should actually show.
//
// Appointments auto-display everything (including past ones), show
// whether each one's been invoiced yet, and have a History button that
// reads the timestamped change log the backend now keeps (see
// scheduling/models.py's AppointmentHistory). Notes are their own
// add/edit-able list instead of one big text field, and any note flagged
// "popup" auto-shows in a dialog the moment this page loads.
// ----------------------------------------------------------------------------

type Client = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
};

type ClientNote = {
  id: number;
  client: number;
  text: string;
  is_popup: boolean;
  created_at: string;
  updated_at: string;
};

type AppointmentHistoryEntry = {
  id: number;
  change_description: string;
  changed_at: string;
};

type Appointment = {
  id: number;
  client: number;
  service: number | null;
  datetime: string;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  history: AppointmentHistoryEntry[];
};

type Service = { id: number; name: string };

type Invoice = {
  id: number;
  invoice_number: string;
  status: "unpaid" | "paid" | "refunded";
  issued_date: string;
  tax_amount: string;
  appointment: number | null;
  line_items: { quantity: string; unit_price: string }[];
};

type Tab = "appointments" | "notes" | "purchases" | "documents";

const TABS: { id: Tab; label: string; icon: typeof Receipt }[] = [
  { id: "purchases", label: "Purchases", icon: Receipt },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "appointments", label: "Appointments", icon: CalendarClock },
  { id: "notes", label: "Notes", icon: StickyNote },
];

export default function ClientProfilePage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { id } = use(params);
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState<ClientNote[] | null>(null);

  const [tab, setTab] = useState<Tab>("appointments");
  const [invoiceModalAppointment, setInvoiceModalAppointment] = useState<Appointment | null>(null);

  // Info panel: view mode vs. edit mode.
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [infoError, setInfoError] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);

  // Appointment history modal — which appointment's log is being shown, if any.
  const [historyFor, setHistoryFor] = useState<Appointment | null>(null);

  // Popup notes — shown automatically once, the first time notes load.
  const [popupNotes, setPopupNotes] = useState<ClientNote[] | null>(null);
  const [shownPopups, setShownPopups] = useState(false);

  // Notes tab: add form + per-note edit state.
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteIsPopup, setNewNoteIsPopup] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [editNoteIsPopup, setEditNoteIsPopup] = useState(false);

  function loadClient() {
    apiFetch<Client>(`/api/clients/${id}/`).then((c) => {
      setClient(c);
      setFirstName(c.first_name);
      setLastName(c.last_name);
      setEmail(c.email);
      setPhone(c.phone);
      setAddress(c.address);
    });
  }

  function loadNotes() {
    apiFetch<ClientNote[]>(`/api/clients/notes/?client=${id}`).then((fetched) => {
      setNotes(fetched);
      if (!shownPopups) {
        const popups = fetched.filter((n) => n.is_popup);
        if (popups.length > 0) setPopupNotes(popups);
        setShownPopups(true);
      }
    });
  }

  useEffect(() => {
    loadClient();
    apiFetch<Invoice[]>(`/api/invoicing/invoices/?client=${id}`).then(setInvoices);
    apiFetch<Appointment[]>(`/api/scheduling/appointments/?client=${id}`).then(setAppointments);
    apiFetch<Service[]>("/api/services/").then(setServices);
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function serviceName(serviceId: number | null) {
    if (serviceId === null) return "—";
    return services.find((s) => s.id === serviceId)?.name ?? `Service #${serviceId}`;
  }

  function invoiceForAppointment(appointmentId: number) {
    return invoices?.find((inv) => inv.appointment === appointmentId) ?? null;
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoError(null);

    if (!email && !phone) {
      setInfoError("Enter at least an email or a phone number.");
      return;
    }

    setSavingInfo(true);
    try {
      const updated = await apiFetch<Client>(`/api/clients/${id}/`, {
        method: "PATCH",
        body: { first_name: firstName, last_name: lastName, email, phone, address },
      });
      setClient(updated);
      setEditing(false);
    } catch (err) {
      setInfoError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleDelete() {
    if (!client) return;
    if (!confirm(`Delete ${client.full_name}? This can't be undone.`)) return;
    await apiFetch(`/api/clients/${id}/`, { method: "DELETE" });
    router.push("/dashboard/clients");
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    setNotesError(null);
    if (!newNoteText.trim()) return;

    setAddingNote(true);
    try {
      await apiFetch("/api/clients/notes/", {
        method: "POST",
        body: { client: Number(id), text: newNoteText, is_popup: newNoteIsPopup },
      });
      setNewNoteText("");
      setNewNoteIsPopup(false);
      apiFetch<ClientNote[]>(`/api/clients/notes/?client=${id}`).then(setNotes); // just refresh the list — popups already resolved on first load
    } catch (err) {
      setNotesError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setAddingNote(false);
    }
  }

  function startEditingNote(note: ClientNote) {
    setEditingNoteId(note.id);
    setEditNoteText(note.text);
    setEditNoteIsPopup(note.is_popup);
  }

  async function handleSaveNoteEdit(noteId: number) {
    setNotesError(null);
    try {
      await apiFetch(`/api/clients/notes/${noteId}/`, {
        method: "PATCH",
        body: { text: editNoteText, is_popup: editNoteIsPopup },
      });
      setEditingNoteId(null);
      apiFetch<ClientNote[]>(`/api/clients/notes/?client=${id}`).then(setNotes);
    } catch (err) {
      setNotesError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!confirm("Delete this note?")) return;
    await apiFetch(`/api/clients/notes/${noteId}/`, { method: "DELETE" });
    apiFetch<ClientNote[]>(`/api/clients/notes/?client=${id}`).then(setNotes);
  }

  function invoiceTotal(invoice: Invoice) {
    const lineTotal = invoice.line_items.reduce((sum, li) => sum + Number(li.quantity) * Number(li.unit_price), 0);
    return lineTotal + Number(invoice.tax_amount);
  }

  if (!client) return <p className="text-sm text-gray-500">Loading…</p>;

  // A few at-a-glance numbers for the header strip — how much this client
  // has actually paid, how many times they've been in, and when they're
  // next expected — so the profile reads like a relationship summary
  // rather than just a stack of tabs.
  const lifetimeSpent = (invoices ?? [])
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + invoiceTotal(inv), 0);
  const visitCount = (appointments ?? []).filter((a) => a.status === "completed").length;
  const nextAppointment = (appointments ?? [])
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())[0];
  const initials = `${client.first_name?.charAt(0) ?? ""}${client.last_name?.charAt(0) ?? ""}`.toUpperCase() || "?";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> All clients
        </Link>
      </div>

      {/* Header strip — avatar, name, and lifetime stats up front, the way
          a CRM contact record leads with "who is this and what's our
          history" instead of jumping straight to a form. */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="accent-bg flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold shadow-sm">
            {initials}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{client.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              {client.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" strokeWidth={2} /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" strokeWidth={2} /> {client.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 rounded-xl bg-gray-50/70 px-5 py-3 sm:gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Lifetime spent</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-gray-900">${lifetimeSpent.toFixed(2)}</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Visits</p>
            <p className="mt-0.5 text-lg font-semibold text-gray-900">{visitCount}</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Next visit</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">
              {nextAppointment
                ? new Date(nextAppointment.datetime).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* Left: client info, view mode by default with an Edit toggle */}
        <Card className="h-fit rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Contact info</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} /> Edit
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSaveInfo} className="mt-4 space-y-4">
              <Field label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Field label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={savingInfo}>
                  {savingInfo ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setInfoError(null);
                    setFirstName(client.first_name);
                    setLastName(client.last_name);
                    setEmail(client.email);
                    setPhone(client.phone);
                    setAddress(client.address);
                  }}
                >
                  Cancel
                </Button>
              </div>
              <ErrorText>{infoError}</ErrorText>
            </form>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3 rounded-lg bg-gray-50/70 p-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{client.email || "—"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-gray-50/70 p-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Phone</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{client.phone || "—"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-gray-50/70 p-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Address</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{client.address || "—"}</dd>
                </div>
              </div>
            </dl>
          )}

          <div className="mt-6 border-t border-gray-100 pt-4">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} /> Delete client
            </button>
          </div>
        </Card>

        {/* Right: tabbed panel */}
        <Card className="rounded-2xl p-6 shadow-sm">
          <div className="flex gap-1 border-b border-gray-200">
            {TABS.map((t) => {
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? "border-b-2 border-[var(--accent-600,#059669)] text-[var(--accent-700,#047857)]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <TabIcon className="h-4 w-4" strokeWidth={2} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {tab === "purchases" && (
              <div>
                {invoices === null ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : invoices.length === 0 ? (
                  <EmptyState icon={Receipt} text="No invoices for this client yet." />
                ) : (
                  <ul className="space-y-2">
                    {invoices.map((invoice) => (
                      <li key={invoice.id}>
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition-colors hover:border-gray-200 hover:bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                              <Receipt className="h-4 w-4 text-gray-400" strokeWidth={2} />
                            </span>
                            <div>
                              <p className="font-mono text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                              <p className="text-xs text-gray-500">{invoice.issued_date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-semibold text-gray-900">${invoiceTotal(invoice).toFixed(2)}</p>
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                                invoice.status === "paid"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : invoice.status === "refunded"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {invoice.status}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "documents" && (
              <EmptyState icon={FileText} text="Document storage isn't set up yet. Check back soon." />
            )}

            {tab === "appointments" && (
              <div>
                {appointments === null ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : appointments.length === 0 ? (
                  <EmptyState icon={CalendarClock} text="No appointments for this client yet." />
                ) : (
                  <ul className="space-y-2">
                    {appointments.map((appt) => {
                      const invoice = invoiceForAppointment(appt.id);
                      return (
                        <li
                          key={appt.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                              <CalendarClock className="h-4 w-4 text-gray-400" strokeWidth={2} />
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{serviceName(appt.service)}</p>
                              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Clock className="h-3 w-3" strokeWidth={2} />
                                {new Date(appt.datetime).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                                <span className="text-gray-300">·</span>#{appt.id}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {invoice ? (
                              <Link
                                href={`/dashboard/invoices/${invoice.id}`}
                                className="text-sm font-medium text-emerald-700 hover:underline"
                              >
                                Invoiced #{invoice.invoice_number}
                              </Link>
                            ) : appt.status === "cancelled" ? (
                              <span className="text-sm text-gray-500">Cancelled</span>
                            ) : appt.status === "no_show" ? (
                              <span className="text-sm font-medium text-red-600">No show</span>
                            ) : appt.status === "completed" ? (
                              <button
                                onClick={() => setInvoiceModalAppointment(appt)}
                                className="text-sm font-medium text-emerald-700 hover:underline"
                              >
                                Create invoice
                              </button>
                            ) : (
                              <span className="text-sm font-medium text-emerald-700">Active</span>
                            )}
                            <button
                              onClick={() => setHistoryFor(appt)}
                              className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                            >
                              History
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {tab === "notes" && (
              <div className="space-y-4">
                <form onSubmit={handleAddNote} className="space-y-2 border-b border-gray-200 pb-4">
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    rows={3}
                    placeholder="Add a note…"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={newNoteIsPopup}
                        onChange={(e) => setNewNoteIsPopup(e.target.checked)}
                        className="rounded"
                      />
                      <Bell className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
                      Show as a popup when opening this profile
                    </label>
                    <Button type="submit" disabled={addingNote || !newNoteText.trim()}>
                      {addingNote ? "Saving…" : "Save note"}
                    </Button>
                  </div>
                  <ErrorText>{notesError}</ErrorText>
                </form>

                {notes === null ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : notes.length === 0 ? (
                  <EmptyState icon={StickyNote} text="No notes yet." />
                ) : (
                  <ul className="space-y-2">
                    {notes.map((note) => (
                      <li key={note.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              rows={3}
                              className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={editNoteIsPopup}
                                  onChange={(e) => setEditNoteIsPopup(e.target.checked)}
                                  className="rounded"
                                />
                                Show as a popup when opening this profile
                              </label>
                              <div className="flex items-center gap-3">
                                <Button type="button" onClick={() => handleSaveNoteEdit(note.id)}>
                                  Save
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setEditingNoteId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="whitespace-pre-wrap text-sm text-gray-900">{note.text}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">
                                  {new Date(note.created_at).toLocaleDateString()}
                                </span>
                                {note.is_popup && (
                                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                    <Bell className="h-3 w-3" strokeWidth={2} /> Popup
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => startEditingNote(note)}
                                  className="text-xs font-medium text-emerald-700 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-xs font-medium text-red-600 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Appointment history modal */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-md rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <CalendarClock className="h-5 w-5 text-gray-400" strokeWidth={2} />
                Appointment #{historyFor.id}
              </h2>
              <button
                onClick={() => setHistoryFor(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {historyFor.history.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No changes have been made to this appointment.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {historyFor.history.map((entry) => (
                  <li key={entry.id} className="rounded-lg bg-gray-50/70 p-3 text-sm">
                    <p className="text-gray-900">{entry.change_description}</p>
                    <p className="mt-1 text-xs text-gray-400">{new Date(entry.changed_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 text-right">
              <Button variant="secondary" onClick={() => setHistoryFor(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Popup notes — shown automatically once, the first time notes load */}
      {popupNotes && popupNotes.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Bell className="h-5 w-5 text-amber-500" strokeWidth={2} />
              {popupNotes.length > 1 ? "Notes for this client" : "Note for this client"}
            </h2>
            <ul className="mt-4 space-y-3">
              {popupNotes.map((note) => (
                <li
                  key={note.id}
                  className="whitespace-pre-wrap rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-gray-900"
                >
                  {note.text}
                </li>
              ))}
            </ul>
            <div className="mt-6 text-right">
              <Button onClick={() => setPopupNotes(null)}>Got it</Button>
            </div>
          </Card>
        </div>
      )}

      {invoiceModalAppointment && (
        <CreateInvoiceModal
          clientId={invoiceModalAppointment.client}
          appointmentId={invoiceModalAppointment.id}
          initialServiceId={invoiceModalAppointment.service}
          onClose={() => {
            setInvoiceModalAppointment(null);
            // Refresh so the Appointments tab immediately shows
            // "Invoiced #..." for this one instead of "Create invoice".
            apiFetch<Invoice[]>(`/api/invoicing/invoices/?client=${id}`).then(setInvoices);
            apiFetch<Appointment[]>(`/api/scheduling/appointments/?client=${id}`).then(setAppointments);
          }}
        />
      )}
    </div>
  );
}

// A shared "nothing here yet" block for the tab panel, so every empty
// state (purchases, documents, appointments, notes) shares one quiet,
// icon-led look instead of a plain line of gray text.
function EmptyState({ icon: Icon, text }: { icon: typeof Receipt; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
      <Icon className="h-6 w-6 text-gray-300" strokeWidth={2} />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
