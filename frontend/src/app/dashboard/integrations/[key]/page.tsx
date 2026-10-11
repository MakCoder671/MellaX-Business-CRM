"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plug, X } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import {
  ACCESS_LABEL,
  ACCESS_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
  type IntegrationDetail,
  type IntegrationGuide,
} from "@/lib/integrations";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";

type CalendarChoice = { name: string; url: string };

// One integration's page: what it does, the steps to set it up, and the setup
// panel. Every step is written for the owner to do alone, with no calls needed.
export default function IntegrationDetailPage({ params }: PageProps<"/dashboard/integrations/[key]">) {
  const { key } = use(params);
  const [item, setItem] = useState<IntegrationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetches this integration again. Used on first load and after a connect or disconnect.
  const reload = useCallback(
    () =>
      apiFetch<IntegrationDetail>(`/api/integrations/${key}/`)
        .then(setItem)
        .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load this integration.")),
    [key],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return (
      <div className="max-w-4xl space-y-6">
        <BackLink />
        <ErrorText>{loadError}</ErrorText>
      </div>
    );
  }
  if (!item) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-4xl space-y-6">
      <BackLink />
      <PageHeader icon={Plug} title={item.name} description={item.tagline} />

      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${ACCESS_STYLE[item.access]}`}>
          {ACCESS_LABEL[item.access]}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-500/20">
          {item.sync === "one_way" ? "One way: MellaX sends data out" : "Two way: results come back to MellaX"}
        </span>
      </div>

      <GuideBody guide={item.guide} />

      <SetupPanel item={item} onChanged={reload} />
    </div>
  );
}

// The whole written guide, in the same order for every integration, so owners
// always know where to look: what works now, what to prepare, the steps, the
// limits, and the fixes for common messages.
function GuideBody({ guide }: { guide: IntegrationGuide }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-sky-950">
        <p className="font-semibold">Right now</p>
        <p className="mt-1">{guide.right_now}</p>
      </div>

      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Before you start</h2>
        <ul className="mt-4 space-y-3">
          {guide.before_you_start.map((line) => (
            <li key={line} className="flex gap-3 text-sm leading-relaxed text-gray-700">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Set it up, step by step</h2>
        <ol className="mt-5 space-y-6">
          {guide.setup.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                <ul className="mt-2 space-y-2">
                  {step.details.map((line) => (
                    <li key={line} className="text-sm leading-relaxed text-gray-700">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {guide.help.map((section) => (
        <Card key={section.title} className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{section.title}</h2>
          <ul className="mt-4 space-y-3">
            {section.items.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border-emerald-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-emerald-900">What it can do</h2>
          {guide.can_do.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">Nothing yet. This isn&apos;t switched on.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {guide.can_do.map((line) => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="rounded-2xl border-rose-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-rose-900">What it can&apos;t do</h2>
          <ul className="mt-4 space-y-3">
            {guide.cannot_do.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" strokeWidth={2.5} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {guide.coming_next.length > 0 && (
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Coming next</h2>
          <p className="mt-1 text-sm text-gray-500">These are planned. They don&apos;t work yet.</p>
          <ul className="mt-4 space-y-3">
            {guide.coming_next.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">If something goes wrong</h2>
        <p className="mt-1 text-sm text-gray-500">Find the message you see below. The fix is right under it.</p>
        <dl className="mt-5 divide-y divide-gray-100">
          {guide.problems.map((item) => (
            <div key={item.problem} className="py-4 first:pt-0 last:pb-0">
              <dt className="text-sm font-semibold text-gray-900">&ldquo;{item.problem}&rdquo;</dt>
              <dd className="mt-1 text-sm leading-relaxed text-gray-700">{item.fix}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/integrations" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" />
      All integrations
    </Link>
  );
}

// The part that does the connecting. It only offers Connect when this plan and
// any purchase allow it, and it says why when they don't.
function SetupPanel({ item, onChanged }: { item: IntegrationDetail; onChanged: () => Promise<unknown> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [calendars, setCalendars] = useState<CalendarChoice[] | null>(null);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (item.access === "upgrade") {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Setup</h2>
        <p className="mt-2 text-sm text-gray-600">This comes with the Plus plan. Upgrade your plan to connect it.</p>
      </Card>
    );
  }

  if (item.status === "coming_soon") {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Setup</h2>
        <p className="mt-2 text-sm text-gray-600">This one is still being finished. You&apos;ll be able to connect it here soon.</p>
      </Card>
    );
  }

  if (item.access === "one_time") {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Setup</h2>
        <p className="mt-2 text-sm text-gray-600">
          This is a one-time purchase. Once you buy it, the setup form appears here. Purchases open soon.
        </p>
      </Card>
    );
  }

  // Connected already: show that it's working, and let the owner disconnect.
  if (item.status === "connected" || item.status === "error") {
    async function disconnect() {
      if (!confirm(`Disconnect ${item.name}? Events already on your calendar stay there.`)) return;
      setBusy(true);
      setError(null);
      try {
        await apiFetch(`/api/integrations/${item.key}/disconnect/`, { method: "DELETE" });
        await onChanged();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't disconnect. Try again.");
      } finally {
        setBusy(false);
      }
    }

    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Setup</h2>
        {item.status === "error" && item.last_error && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{item.last_error}</p>
        )}
        {item.status === "connected" && <p className="mt-2 text-sm text-gray-600">It&apos;s connected and working.</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" variant="danger" onClick={disconnect} disabled={busy}>
            Disconnect
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      </Card>
    );
  }

  // Not connected yet, and this account is allowed to connect it.
  async function connect(extra: Record<string, string> = {}) {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ needs_calendar?: boolean; calendars?: CalendarChoice[] }>(
        `/api/integrations/${item.key}/connect/`,
        { method: "POST", body: { ...values, ...extra } },
      );
      if (result.needs_calendar) {
        // Step two: they've signed in, now they choose which calendar to use.
        setCalendars(result.calendars ?? []);
        setPicked(result.calendars?.[0]?.url ?? "");
      } else {
        setCalendars(null);
        await onChanged();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Connect {item.name}</h2>

      {calendars ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-600">Choose the calendar you want appointments to go into. Pick it from this list. You don&apos;t need to type its name.</p>
          <div className="space-y-2" role="radiogroup" aria-label="Calendars">
            {calendars.map((c) => (
              <label key={c.url} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50">
                <input type="radio" name="calendar" value={c.url} checked={picked === c.url} onChange={() => setPicked(c.url)} />
                {c.name}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => connect({ calendar_url: picked })} disabled={busy || !picked}>
              {busy ? "Connecting…" : "Connect this calendar"}
            </Button>
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
        >
          {item.fields.map((field) => {
            const shown = revealed[field.name] === true;
            return (
              <div key={field.name}>
                <Field
                  label={field.label}
                  type={field.type === "password" && shown ? "text" : field.type}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={values[field.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                />
                {field.type === "password" && (
                  // Lets the owner check what they typed or pasted before pressing Connect.
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={shown}
                      onChange={(e) => setRevealed((r) => ({ ...r, [field.name]: e.target.checked }))}
                    />
                    Show what I typed
                  </label>
                )}
                {field.help && <p className="mt-1 text-xs text-gray-500">{field.help}</p>}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </Button>
            <ErrorText>{error}</ErrorText>
          </div>
        </form>
      )}
    </Card>
  );
}
