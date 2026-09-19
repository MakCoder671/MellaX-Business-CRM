"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<Client[]>("/api/clients/").then(setClients);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/clients/", { method: "POST", body: { name, email, phone, notes: "" } });
      setName("");
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
    if (!confirm(`Delete ${client.name}? This can't be undone.`)) return;
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
          <form onSubmit={handleCreate} className="grid grid-cols-3 gap-3">
            <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="col-span-3 flex items-center gap-3">
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
              <div>
                <p className="font-medium">{client.name}</p>
                <p className="text-sm text-gray-500">{client.email || client.phone || "—"}</p>
              </div>
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
