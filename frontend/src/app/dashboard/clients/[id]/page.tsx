"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

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

const TABS: { id: Tab; label: string }[] = [
  { id: "purchases", label: "Purchases" },
  { id: "documents", label: "Documents" },
  { id: "appointments", label: "Appointments" },
  { id: "notes", label: "Notes" },
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/clients" className="text-sm text-emerald-700 underline">
          ← All clients
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{client.full_name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* Left: client info, view mode by default with an Edit toggle */}
        <Card className="h-fit p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Info</h2>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-sm text-emerald-700 hover:underline">
                Edit
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
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</dt>
                <dd className="mt-0.5 text-gray-900">{client.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Phone</dt>
                <dd className="mt-0.5 text-gray-900">{client.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Address</dt>
                <dd className="mt-0.5 text-gray-900">{client.address || "—"}</dd>
              </div>
            </dl>
          )}

          <div className="mt-6 border-t border-gray-200 pt-4">
            <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">
              Delete client
            </button>
          </div>
        </Card>

        {/* Right: tabbed panel */}
        <Card className="p-6">
          <div className="flex gap-1 border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm font-medium ${
                  tab === t.id
                    ? "border-b-2 border-[var(--accent-600,#059669)] text-[var(--accent-700,#047857)]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "purchases" && (
              <div>
                {invoices === null ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-gray-500">No invoices for this client yet.</p>
                ) : (
                  <Card className="divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="flex items-center justify-between p-4 hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <p className="text-sm text-gray-500">{invoice.issued_date}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${invoiceTotal(invoice).toFixed(2)}</p>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
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
                    ))}
                  </Card>
                )}
              </div>
            )}

            {tab === "documents" && (
              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-400">
                Document storage isn&apos;t set up yet. Check back soon.
              </div>
            )}

            {tab === "appointments" && (
              <div>
                {appointments === null ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : appointments.length === 0 ? (
                  <p className="text-sm text-gray-500">No appointments for this client yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                          <th className="pb-2 font-medium">Appt ID</th>
                          <th className="pb-2 font-medium">Date &amp; time</th>
                          <th className="pb-2 font-medium">Service</th>
                          <th className="pb-2 font-medium">Action</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((appt) => {
                          const invoice = invoiceForAppointment(appt.id);
                          return (
                            <tr key={appt.id} className="border-b border-gray-100">
                              <td className="py-2.5 text-gray-500">#{appt.id}</td>
                              <td className="py-2.5 text-gray-900">
                                {new Date(appt.datetime).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </td>
                              <td className="py-2.5 text-gray-900">{serviceName(appt.service)}</td>
                              <td className="py-2.5">
                                {invoice ? (
                                  <Link
                                    href={`/dashboard/invoices/${invoice.id}`}
                                    className="text-emerald-700 underline"
                                  >
                                    Invoiced #{invoice.invoice_number}
                                  </Link>
                                ) : appt.status === "cancelled" ? (
                                  <span className="text-gray-500">Cancelled</span>
                                ) : appt.status === "no_show" ? (
                                  <span className="font-medium text-red-600">No show</span>
                                ) : appt.status === "completed" ? (
                                  <button
                                    onClick={() => setInvoiceModalAppointment(appt)}
                                    className="text-emerald-700 underline"
                                  >
                                    Create invoice
                                  </button>
                                ) : (
                                  <span className="font-medium text-emerald-700">Active</span>
                                )}
                              </td>
                              <td className="py-2.5 text-right">
                                <button
                                  onClick={() => setHistoryFor(appt)}
                                  className="text-xs text-gray-500 underline hover:text-gray-700"
                                >
                                  History
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={newNoteIsPopup}
                        onChange={(e) => setNewNoteIsPopup(e.target.checked)}
                      />
                      Show this note as a popup when opening this profile
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
                  <p className="text-sm text-gray-500">No notes yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {notes.map((note) => (
                      <li key={note.id} className="rounded-md border border-gray-200 p-3">
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              rows={3}
                              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={editNoteIsPopup}
                                  onChange={(e) => setEditNoteIsPopup(e.target.checked)}
                                />
                                Show this note as a popup when opening this profile
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
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                    Popup
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => startEditingNote(note)}
                                  className="text-xs text-emerald-700 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-xs text-red-600 hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">History for appointment #{historyFor.id}</h2>
              <button onClick={() => setHistoryFor(null)} className="text-sm text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            {historyFor.history.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No changes have been made to this appointment.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {historyFor.history.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="text-gray-900">{entry.change_description}</p>
                    <p className="text-xs text-gray-400">{new Date(entry.changed_at).toLocaleString()}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold">
              {popupNotes.length > 1 ? "Notes for this client" : "Note for this client"}
            </h2>
            <ul className="mt-4 space-y-3">
              {popupNotes.map((note) => (
                <li key={note.id} className="whitespace-pre-wrap rounded-md bg-amber-50 p-3 text-sm text-gray-900">
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
