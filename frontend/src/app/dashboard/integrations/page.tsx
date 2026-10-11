"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { ACCESS_LABEL, ACCESS_STYLE, STATUS_LABEL, STATUS_STYLE, type IntegrationSummary } from "@/lib/integrations";
import { ErrorText } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { BrandMark } from "@/components/integrations/BrandMark";

// The Integrations store. Every plan sees every integration. Each card shows
// what it costs on this plan, and its status. Tap one to read more and set it up.
export default function IntegrationsPage() {
  const [items, setItems] = useState<IntegrationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<IntegrationSummary[]>("/api/integrations/")
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load integrations."));
  }, []);

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        icon={Plug}
        title="Integrations"
        description="Connect the tools you already use. Each one shows what it does and how to set it up, step by step."
      />

      <ErrorText>{error}</ErrorText>
      {!items && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {/* Payment methods that don't need a connection. They're recorded on an invoice by name. */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Payment methods you can record today</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          Choose any of these when you record a payment on an invoice. Apple Pay also works through Stripe, Clover, or
          Square once you connect one of them. Venmo, Zelle, and Cash App don&apos;t offer a connection that small
          businesses can set up, so those payments are recorded by hand with the method name.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Apple Pay", "Venmo", "Zelle", "Cash App"].map((method) => (
            <span key={method} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
              {method}
            </span>
          ))}
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((item) => (
          <li key={item.key}>
            <Link
              href={`/dashboard/integrations/${item.key}`}
              className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <BrandMark integrationKey={item.key} name={item.name} />
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">{item.category}</p>
              <p className="mt-1 text-base font-semibold text-gray-900">{item.name}</p>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-600">{item.tagline}</p>
              <div className="mt-4">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${ACCESS_STYLE[item.access]}`}>
                  {ACCESS_LABEL[item.access]}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
