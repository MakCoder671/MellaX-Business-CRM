"use client";

import { useEffect, useState } from "react";
import { FileText, Mail, Megaphone, Send, Sparkles, Users } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EBLAST_TEMPLATES } from "@/lib/eblast-templates";
import { Button, Card, ErrorText } from "@/components/form";
import { MarketingTabs } from "@/components/MarketingTabs";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ReachChart } from "@/components/marketing/ReachChart";

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
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">New e-blast</h2>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700">Start from a template</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EBLAST_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => applyTemplate(t.key)}
              className={`rounded-xl border p-2.5 text-left text-sm transition-colors ${
                templateKey === t.key
                  ? "border-[var(--accent-600,#059669)] bg-[var(--accent-50,#ecfdf5)] ring-1 ring-[var(--accent-600,#059669)]"
                  : "border-gray-200 hover:border-gray-300"
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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]"
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
        <Button
          className="inline-flex items-center gap-1.5"
          disabled={savingDraft || sending || !subject || !body}
          onClick={() => handleSubmit(true)}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2.5} />
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

  const sent = (eblasts?.filter((e) => e.sent_at) ?? []) as (EBlast & { sent_at: string })[];
  const drafts = eblasts?.filter((e) => !e.sent_at) ?? [];
  const totalReach = sent.reduce((sum, e) => sum + e.recipient_count, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Marketing"
        description="Reach your clients with e-blasts, and track promotions with campaigns."
      />
      <MarketingTabs />

      {eblasts && eblasts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard icon={Send} label="E-blasts sent" value={sent.length} />
          <StatCard icon={Users} label="Total reach" value={totalReach} tone="neutral" />
          <StatCard icon={FileText} label="Drafts" value={drafts.length} tone="neutral" />
        </div>
      )}

      <ReachChart eblasts={sent} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">E-blasts</h2>
        <Button onClick={() => setShowCompose((v) => !v)} className="inline-flex items-center gap-1.5">
          <Mail className="h-4 w-4" strokeWidth={2.5} />
          {showCompose ? "Cancel" : "New e-blast"}
        </Button>
      </div>

      {/* Per the plan doc: Basic gets manual e-blasts; Plus adds direct
          social posting and AI-drafted content. This banner is the
          in-app nudge the doc calls for — no Plus feature is actually
          built yet, just the prompt. */}
      {account?.plan_tier === "basic" && (
        <Card className="flex items-start gap-3 rounded-2xl border-[var(--accent-200,#a7f3d0)] bg-[var(--accent-50,#ecfdf5)] p-4 text-sm text-[var(--accent-800,#065f46)] shadow-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>
            Upgrade to Plus for auto-posting to social media and AI-drafted content, campaigns in minutes instead
            of writing everything by hand.
          </p>
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
        <Card className="rounded-2xl p-10 text-center shadow-sm">
          <Mail className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-gray-600">
            You haven&apos;t sent any e-blasts yet. Create your first one above.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {eblasts.map((eblast) => (
            <Card key={eblast.id} className="rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900">{eblast.subject}</p>
                {eblast.sent_at ? (
                  <span className="shrink-0 rounded-full bg-[var(--accent-50,#ecfdf5)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-700,#047857)]">
                    Sent to {eblast.recipient_count}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    Draft
                  </span>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-500">{eblast.body}</p>
              {!eblast.sent_at && (
                <div className="mt-3 flex gap-4 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => handleSendDraft(eblast)}
                    className="text-sm font-medium text-[var(--accent-700,#047857)] hover:underline"
                  >
                    Send to all clients
                  </button>
                  <button onClick={() => handleDeleteDraft(eblast)} className="text-sm font-medium text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
