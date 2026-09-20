"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// A client's profile page — their info (editable in place) plus a
// "Purchases" tab underneath showing every invoice tied to them, per
// business_plan.MD's Basic Plan: "every invoice appears under a
// Purchases tab on that client's profile, so a business can see a
// client's full purchase and payment history in one place." The
// invoices list already supported filtering by ?client=<id> (built
// for this exact purpose) — this page is the first thing that actually uses it.
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

type Invoice = {
  id: number;
  invoice_number: string;
  status: "unpaid" | "paid" | "refunded";
  issued_date: string;
  tax_amount: string;
  line_items: { quantity: string; unit_price: string }[];
};

export default function ClientProfilePage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { id } = use(params);
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<Client>(`/api/clients/${id}/`).then((c) => {
      setClient(c);
      setFirstName(c.first_name);
      setLastName(c.last_name);
      setEmail(c.email);
      setPhone(c.phone);
      setNotes(c.notes);
    });
    apiFetch<Invoice[]>(`/api/invoicing/invoices/?client=${id}`).then(setInvoices);
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!email && !phone) {
      setError("Enter at least an email or a phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await apiFetch<Client>(`/api/clients/${id}/`, {
        method: "PATCH",
        body: { first_name: firstName, last_name: lastName, email, phone, notes },
      });
      setClient(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!client) return;
    if (!confirm(`Delete ${client.full_name}? This can't be undone.`)) return;
    await apiFetch(`/api/clients/${id}/`, { method: "DELETE" });
    router.push("/dashboard/clients");
  }

  function invoiceTotal(invoice: Invoice) {
    const lineTotal = invoice.line_items.reduce((sum, li) => sum + Number(li.quantity) * Number(li.unit_price), 0);
    return lineTotal + Number(invoice.tax_amount);
  }

  if (!client) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/clients" className="text-sm text-emerald-700 underline">
          ← All clients
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{client.full_name}</h1>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Profile</h2>
          <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">
            Delete client
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Field label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
            {saved && <span className="text-sm text-emerald-700">Saved.</span>}
            <ErrorText>{error}</ErrorText>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-medium">Purchases</h2>
        <p className="mt-1 text-sm text-gray-500">Every invoice tied to this client, in one place.</p>

        {invoices === null ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No invoices for this client yet.</p>
        ) : (
          <Card className="mt-4 divide-y divide-gray-200">
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
      </Card>
    </div>
  );
}
