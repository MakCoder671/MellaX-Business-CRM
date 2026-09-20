"use client";

import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EBLAST_TEMPLATES } from "@/lib/eblast-templates";
import { Button, Card, ErrorText } from "@/components/form";
import { MarketingTabs } from "@/components/MarketingTabs";

// ----------------------------------------------------------------------------
// The Marketing tab — Basic Plan's e-blast tool. Pick a template (or
// start blank), edit the subject/body, then either save it as a draft
// or send it straight to every client that has an email on file.
//
// Once something is sent it's locked (see marketing/serializers.py on
// the backend) — this page reflects that by hiding the edit/send
// controls for anything with a `sent_at`, showing it as a read-only
// past e-blast instead.
// ----------------------------------------------------------------------------

type EBlast = {
  id: number;
  subject: string;
  body: string;
  template_key: string;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
};

function ComposeForm({ onDone }: { onDone: () => void }) {
  const [templateKey, setTemplateKey] = useState(EBLAST_TEMPLATES[0].key);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending] = useState(false);

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const template = EBLAST_TEMPLATES.find((t) => t.key === key);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }

  // Both "Save as draft" and "Send now" start the same way (create the
  // row) — they only diverge on whether a second request fires
  // afterward to actually send it. `send` being a parameter here (rather
  // than two separately copy-pasted functions) keeps that shared part
  // written once.
  async function handleSubmit(send: boolean) {
    setError(null);
    if (send) {
      setSending(true);
    } else {
      setSavingDraft(true);
    }
    try {
      const eblast = await apiFetch<EBlast>("/api/marketing/eblasts/", {
        method: "POST",
        body: { subject, body, template_key: templateKey },
      });
      if (send) {
        await apiFetch(`/api/marketing/eblasts/${eblast.id}/send/`, { method: "POST" });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingDraft(false);
      setSending(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium">New e-blast</h2>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700">Start from a template</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EBLAST_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => applyTemplate(t.key)}
              className={`rounded-md border p-2 text-left text-sm transition-colors ${
                templateKey === t.key
                  ? "border-emerald-600 ring-1 ring-emerald-600"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={savingDraft || sending || !subject || !body}
          onClick={() => handleSubmit(false)}
        >
          {savingDraft ? "Saving…" : "Save as draft"}
        </Button>
        <Button disabled={savingDraft || sending || !subject || !body} onClick={() => handleSubmit(true)}>
          {sending ? "Sending…" : "Send to all clients"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </Card>
  );
}

export default function MarketingPage() {
  const { account } = useAuth();
  const [eblasts, setEblasts] = useState<EBlast[] | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<EBlast[]>("/api/marketing/eblasts/").then(setEblasts);
  }

  useEffect(load, []);

  async function handleSendDraft(eblast: EBlast) {
    setError(null);
    try {
      await apiFetch(`/api/marketing/eblasts/${eblast.id}/send/`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleDeleteDraft(eblast: EBlast) {
    if (!confirm(`Delete this draft ("${eblast.subject}")?`)) return;
    await apiFetch(`/api/marketing/eblasts/${eblast.id}/`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Marketing</h1>
      <MarketingTabs />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">E-blasts</h2>
        <Button onClick={() => setShowCompose((v) => !v)}>
          {showCompose ? "Cancel" : "New e-blast"}
        </Button>
      </div>

      {/* Per the plan doc: Basic gets manual e-blasts; Plus adds direct
          social posting and AI-drafted content. This banner is the
          in-app nudge the doc calls for — no Plus feature is actually
          built yet, just the prompt. */}
      {account?.plan_tier === "basic" && (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Upgrade to Plus for auto-posting to social media and AI-drafted content — campaigns in minutes instead of writing everything by hand.
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      {showCompose && (
        <ComposeForm
          onDone={() => {
            setShowCompose(false);
            load();
          }}
        />
      )}

      {eblasts === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : eblasts.length === 0 ? (
        <Card className="p-6 text-sm text-gray-600">
          You haven&apos;t sent any e-blasts yet — create your first one above.
        </Card>
      ) : (
        <Card className="divide-y divide-gray-200">
          {eblasts.map((eblast) => (
            <div key={eblast.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{eblast.subject}</p>
                {eblast.sent_at ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Sent to {eblast.recipient_count}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    Draft
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-500">{eblast.body}</p>
              {!eblast.sent_at && (
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => handleSendDraft(eblast)}
                    className="text-sm text-emerald-700 underline"
                  >
                    Send to all clients
                  </button>
                  <button
                    onClick={() => handleDeleteDraft(eblast)}
                    className="text-sm text-red-600 underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
