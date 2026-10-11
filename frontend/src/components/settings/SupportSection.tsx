"use client";

import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, ErrorText } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// A bug report, feature idea, question, or billing/refund request — sent
// straight to the owner's inbox (see accounts/views.py's
// SupportRequestViewSet) and listed below so there's a record of what
// was asked and when. Per Mako: this doubles as the main way to learn
// how the software is actually being used, so the form stays this
// simple on purpose rather than routing to different places per category.

type Category = "bug" | "feature" | "question" | "billing";

type SupportRequest = {
  id: number;
  category: Category;
  message: string;
  created_at: string;
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "feature", label: "Feature request" },
  { value: "bug", label: "Bug report" },
  { value: "question", label: "Question" },
  { value: "billing", label: "Billing or refund" },
];

export function SupportSection() {
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [category, setCategory] = useState<Category>("feature");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function load() {
    apiFetch<SupportRequest[]>("/api/accounts/support/").then(setRequests);
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/support/", { method: "POST", body: { category, message } });
      setMessage("");
      setSent(true);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection
      icon={LifeBuoy}
      title="Feedback & Support"
      description="Bugs, feature ideas, questions, or a billing request, sent straight to us."
      tourId="settings-support"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                category === c.value
                  ? "accent-bg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="block text-sm font-medium text-gray-700">
          Message
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="What's going on, or what would make MellaX better for you?"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send"}
          </Button>
          {sent && <span className="text-sm text-emerald-700">Sent. Thanks for the note.</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>

      {requests && requests.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Your past requests</p>
          <ul className="mt-2 space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium text-gray-600">
                    {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                  </span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-gray-700">{r.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SettingsSection>
  );
}
