"use client";

import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, ErrorText } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// ----------------------------------------------------------------------------
// Which IANA timezone the business actually operates in — this is what
// every other Calendar setting (Operating Hours, appointment booking, the
// time grid) now gets interpreted against instead of whatever zone the
// viewing device happens to be in. Comes first on this tab, ahead of
// Operating Hours, since "9 to 5" doesn't mean anything until you know
// which 9 to 5.
//
// The zone list comes straight from the browser's own Intl API
// (Intl.supportedValuesOf("timeZone")) rather than a hardcoded or
// backend-provided list — every modern browser already ships the full,
// current IANA tz database (DST rules included), so there's nothing to
// keep in sync by hand. Grouped by region (the part before the "/") so a
// few hundred zones are actually browsable instead of one giant flat list.
// ----------------------------------------------------------------------------

function zoneLabel(zone: string, now: Date) {
  const city = zone.includes("/") ? zone.slice(zone.lastIndexOf("/") + 1) : zone;
  const readable = city.replace(/_/g, " ");
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  return offset ? `${readable} (${offset})` : readable;
}

function buildZoneGroups() {
  const now = new Date();
  const zones = Intl.supportedValuesOf("timeZone");
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const zone of zones) {
    const region = zone.includes("/") ? zone.slice(0, zone.indexOf("/")) : "Other";
    const list = groups.get(region) ?? [];
    list.push({ value: zone, label: zoneLabel(zone, now) });
    groups.set(region, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, options]) => ({ region, options: options.sort((a, b) => a.label.localeCompare(b.label)) }));
}

export function TimeZoneSection() {
  const { account, refreshAccount } = useAuth();
  const [timeZone, setTimeZone] = useState(account?.time_zone ?? "UTC");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Built once per mount, not on every render — the zone list and each
  // zone's current offset don't change while this form is open.
  const zoneGroups = useMemo(() => buildZoneGroups(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await apiFetch("/api/accounts/me/", { method: "PATCH", body: { time_zone: timeZone } });
      await refreshAccount();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection
      icon={Clock3}
      title="Time Zone"
      description="What your Operating Hours and appointment times actually mean — including daylight saving, automatically."
      tourId="settings-timezone"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Time zone
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]"
          >
            {zoneGroups.map(({ region, options }) => (
              <optgroup key={region} label={region}>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </SettingsSection>
  );
}
