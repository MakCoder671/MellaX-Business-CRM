"use client";

import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// Invoice Settings — the tax rates and defaults that apply to every new
// invoice. Tender Types and Discounts (also part of "Invoice Settings" in
// the plan doc) get their own section components below in this same
// folder, since they're list-based (add/remove many) rather than a
// simple form like this one.
// ----------------------------------------------------------------------------

export function InvoiceSettingsSection() {
  const { account, refreshAccount } = useAuth();
  const [serviceTax, setServiceTax] = useState(account?.service_tax_percent ?? "0");
  const [productTax, setProductTax] = useState(account?.product_tax_percent ?? "0");
  const [prefix, setPrefix] = useState(account?.invoice_prefix ?? "INV-");
  const [terms, setTerms] = useState(account?.default_invoice_terms ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/me/", {
        method: "PATCH",
        body: {
          service_tax_percent: serviceTax,
          product_tax_percent: productTax,
          invoice_prefix: prefix,
          default_invoice_terms: terms,
        },
      });
      await refreshAccount();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium">Invoice Settings</h2>
      <p className="mt-1 text-sm text-gray-500">
        Tax rates default to 0% and auto-calculate onto every new invoice.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Service Tax %"
            type="number"
            step="0.01"
            min="0"
            value={serviceTax}
            onChange={(e) => setServiceTax(e.target.value)}
          />
          <Field
            label="Product Tax %"
            type="number"
            step="0.01"
            min="0"
            value={productTax}
            onChange={(e) => setProductTax(e.target.value)}
          />
        </div>
        <Field
          label="Invoice number prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
        <label className="block text-sm font-medium text-gray-700">
          Default invoice terms
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={2}
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
  );
}
