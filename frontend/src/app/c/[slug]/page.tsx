"use client";

import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";

// ----------------------------------------------------------------------------
// The page a campaign's shareable link OR QR code actually opens —
// completely public, no login. Landing here at all is what counts as a
// "click" or "scan" (see campaigns/views.py's PublicCampaignView — the
// GET request below, just to fetch the campaign's name, is also what
// increments the right counter on the backend). Submitting the form
// below is what turns a visitor into a Lead.
// ----------------------------------------------------------------------------

type PublicCampaign = { name: string; business_name: string };

export default function PublicCampaignPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = use(params);
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [interestedIn, setInterestedIn] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Read straight off window.location instead of the useSearchParams
    // hook — this is a plain one-time read on mount, and avoids that
    // hook's Suspense-boundary requirement for a value we only need once.
    const isQrScan = window.location.search.includes("src=qr");
    const path = `/api/campaigns/public/${slug}/${isQrScan ? "?src=qr" : ""}`;

    apiFetch<PublicCampaign>(path, { auth: false })
      .then(setCampaign)
      .catch(() => setNotFound(true));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/campaigns/public/${slug}/leads/`, {
        method: "POST",
        auth: false,
        body: { name, phone, email, interested_in: interestedIn, message },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-gray-500">
        This link isn&apos;t valid.
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-gray-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">{campaign.business_name}</h1>
      <p className="mt-1 text-sm text-gray-600">{campaign.name}</p>

      <Card className="mt-6 p-6">
        {submitted ? (
          <p className="text-sm text-gray-700">
            Thanks! {campaign.business_name} will be in touch soon.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Field
              label="What are you interested in?"
              value={interestedIn}
              onChange={(e) => setInterestedIn(e.target.value)}
            />
            <label className="block text-sm font-medium text-gray-700">
              Message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending…" : "Send"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
