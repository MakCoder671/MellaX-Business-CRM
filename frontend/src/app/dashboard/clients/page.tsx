"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// This shape mirrors what clients/serializers.py's ClientSerializer sends.
// Split into first_name/last_name instead of one "name" field per Mako —
// gives Data Import/Export (a Fast-Follow feature) clean, unambiguous
// columns to map to, matching what business_plan.MD's Data Import
// section already assumed ("ClientFirstName, ClientLastName").
// ----------------------------------------------------------------------------

type Client = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  notes: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null); // null = still loading, [] = loaded but genuinely empty
  const [showForm, setShowForm] = useState(false); // toggles the "add client" form open/closed
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A plain function (not wrapped in useCallback) that re-fetches the
  // client list — called once on page load, and again after every
  // create/delete so the list always reflects the latest data.
  function load() {
    apiFetch<Client[]>("/api/clients/").then(setClients);
  }

  useEffect(load, []); // the empty [] means "run this once, when the page first mounts"

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // The backend enforces this too (see clients/serializers.py), but
    // catching it here means someone doesn't have to submit the form
    // and wait on a network round-trip just to find out.
    if (!email && !phone) {
      setError("Enter at least an email or a phone number.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/clients/", {
        method: "POST",
        body: { first_name: firstName, last_name: lastName, email, phone, notes: "" },
      });
      // Reset the form back to empty and hide it, then reload the list to
      // show the new client.
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(client: Client) {
    // Per the plan doc's "confirmation prompts on destructive actions"
    // rule — a plain browser confirm() dialog is enough for v1; no
    // custom modal needed for something this simple.
    if (!confirm(`Delete ${client.full_name}? This can't be undone.`)) return;
    await apiFetch(`/api/clients/${client.id}/`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add client"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <Field label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Field label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save client"}
              </Button>
              <ErrorText>{error}</ErrorText>
            </div>
          </form>
        </Card>
      )}

      {clients === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : clients.length === 0 ? (
        <Card className="p-6 text-sm text-gray-600">
          You don&apos;t have any clients yet — add your first one above.
        </Card>
      ) : (
        <Card className="divide-y divide-gray-200">
          {clients.map((client) => (
            <div key={client.id} className="flex items-center justify-between p-4">
              {/* Only the name/info half is a link — the whole row can't
                  be, since the Delete button needs to sit next to it
                  without being nested inside the same clickable link. */}
              <Link href={`/dashboard/clients/${client.id}`} className="min-w-0 flex-1 hover:opacity-80">
                <p className="font-medium text-gray-900">{client.full_name}</p>
                <p className="text-sm text-gray-500">{client.email || client.phone || "—"}</p>
              </Link>
              <button
                onClick={() => handleDelete(client)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
