"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

// Same list-form-delete pattern as the Clients page — see that file's
// comments for the full walkthrough of how it works.

type Service = {
  id: number;
  name: string;
  price: string; // comes back as a string from Django's DecimalField, not a number — that's normal, keeps money math precise
  description: string;
  is_taxable: boolean;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<Service[]>("/api/services/").then(setServices);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/services/", {
        method: "POST",
        body: { name, price, description, is_taxable: true },
      });
      setName("");
      setPrice("");
      setDescription("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(service: Service) {
    if (!confirm(`Delete "${service.name}"? This can't be undone.`)) return;
    await apiFetch(`/api/services/${service.id}/`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Services</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add service"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="grid grid-cols-3 gap-3">
            <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Field
              label="Price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="col-span-3 flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save service"}
              </Button>
              <ErrorText>{error}</ErrorText>
            </div>
          </form>
        </Card>
      )}

      {services === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : services.length === 0 ? (
        <Card className="p-6 text-sm text-gray-600">
          You don&apos;t have any services yet — add your first one above.
        </Card>
      ) : (
        <Card className="divide-y divide-gray-200">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{service.name}</p>
                {service.description && (
                  <p className="text-sm text-gray-500">{service.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">${service.price}</span>
                <button
                  onClick={() => handleDelete(service)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
