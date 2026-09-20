"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button, Card, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// Tender Types — how a payment was received (Cash, Visa, ...). The list
// mixes two kinds of rows: MellaX's own pre-loaded defaults (is_custom:
// false — Cash, Visa, Mastercard, etc, shared by every account) and ones
// this business added themselves (is_custom: true). Only the custom ones
// can be deleted here — the backend enforces that too (see
// invoicing/views.py's TenderTypeViewSet.perform_destroy), this UI just
// avoids showing a delete button that would fail anyway.
// ----------------------------------------------------------------------------

type TenderType = { id: number; name: string; is_custom: boolean };

export function TenderTypesSection() {
  const [tenderTypes, setTenderTypes] = useState<TenderType[] | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<TenderType[]>("/api/invoicing/tender-types/").then(setTenderTypes);
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/invoicing/tender-types/", { method: "POST", body: { name } });
      setName("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(tenderType: TenderType) {
    if (!confirm(`Remove "${tenderType.name}"?`)) return;
    await apiFetch(`/api/invoicing/tender-types/${tenderType.id}/`, { method: "DELETE" });
    load();
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium">Tender Types</h2>
      <p className="mt-1 text-sm text-gray-500">How payments are received. Add your own on top of the built-in defaults.</p>

      {tenderTypes && (
        <ul className="mt-4 divide-y divide-gray-200">
          {tenderTypes.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span>{t.name}</span>
              {t.is_custom ? (
                <button onClick={() => handleDelete(t)} className="text-red-600 hover:underline">
                  Remove
                </button>
              ) : (
                <span className="text-xs text-gray-400">default</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Field label="Add a tender type" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={submitting}>
          Add
        </Button>
      </form>
    </Card>
  );
}
