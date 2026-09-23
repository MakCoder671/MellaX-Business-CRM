"use client";

import { useEffect, useState } from "react";
import { DollarSign, ListChecks, Pencil, Plus, Trash2, Wrench } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

// Same list-form-delete pattern as the Clients page — see that file's
// comments for the full walkthrough of how it works.

type Service = {
  id: number;
  name: string;
  price: string; // comes back as a string from Django's DecimalField, not a number — that's normal, keeps money math precise
  cost: string | null; // what it costs the business to deliver this — optional, used for Cost of Goods Sold in Reports
  description: string;
  is_taxable: boolean;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null); // null = the form (when open) is adding a new service; a real id = it's editing that one instead
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<Service[]>("/api/services/").then(setServices);
  }

  useEffect(load, []);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setPrice("");
    setCost("");
    setDescription("");
  }

  function startAdding() {
    closeForm();
    setShowForm(true);
  }

  function startEditing(service: Service) {
    setEditingId(service.id);
    setName(service.name);
    setPrice(service.price);
    setCost(service.cost ?? "");
    setDescription(service.description);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = { name, price, cost: cost || null, description, is_taxable: true };
      if (editingId === null) {
        await apiFetch("/api/services/", { method: "POST", body });
      } else {
        await apiFetch(`/api/services/${editingId}/`, { method: "PATCH", body });
      }
      closeForm();
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

  const avgPrice =
    services && services.length > 0
      ? services.reduce((sum, s) => sum + Number(s.price), 0) / services.length
      : 0;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon={Wrench}
        title="Services"
        description="What you offer and how much it costs — feeds straight into invoices and booking."
        action={
          <Button onClick={() => (showForm ? closeForm() : startAdding())} className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {showForm ? "Cancel" : "Add service"}
          </Button>
        }
      />

      {services && services.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard icon={ListChecks} label="Services" value={services.length} />
          <StatCard icon={DollarSign} label="Avg. price" value={`$${avgPrice.toFixed(2)}`} />
          <StatCard
            icon={DollarSign}
            label="Taxable"
            value={services.filter((s) => s.is_taxable).length}
            tone="neutral"
          />
        </div>
      )}

      {showForm && (
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{editingId === null ? "New service" : "Edit service"}</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
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
            <Field
              label="Cost (optional)"
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="col-span-full flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId === null ? "Save service" : "Save changes"}
              </Button>
              <ErrorText>{error}</ErrorText>
            </div>
          </form>
        </Card>
      )}

      {services === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : services.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center shadow-sm">
          <Wrench className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-gray-600">
            You don&apos;t have any services yet — add your first one above.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className="group relative flex flex-col gap-3 rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{service.name}</p>
                  {service.description && (
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{service.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEditing(service)}
                    aria-label={`Edit ${service.name}`}
                    className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => handleDelete(service)}
                    aria-label={`Delete ${service.name}`}
                    className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-lg font-semibold text-gray-900">
                  ${service.price}
                  {service.cost !== null && <span className="ml-1 text-xs font-normal text-gray-400">costs ${service.cost}</span>}
                </span>
                {service.is_taxable && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    Taxable
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
