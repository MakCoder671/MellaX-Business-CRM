"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, ErrorText, Field } from "@/components/form";

import { SectionHeader } from "./SectionHeader";
import { FORM_CONTROLS, type PublicLandingPage, formatClock, formatDuration, formatPrice } from "./landing";

// ----------------------------------------------------------------------------
// Online booking for a visitor. Plus accounts only: the page doesn't render
// this section at all otherwise, and the server refuses both requests anyway.
//
// Flow: pick a service, then a day (the slot list fills in from the server,
// which already knows the business's hours, timezone, and existing bookings),
// then a time, then your details. Slots are re-checked on the server when you
// submit, so two people can't both take the same time.
// ----------------------------------------------------------------------------

const MAX_DAYS_AHEAD = 60;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Confirmation = { business_name: string; service: string; when: string };
type SlotResult = { key: string; slots: string[] } | { key: string; error: string };

export function BookingSection({
  page,
  serviceId,
  onServiceChange,
}: {
  page: PublicLandingPage;
  serviceId: number | null;
  onServiceChange: (id: number | null) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0); // bumped to force a slot reload after a "that time was just taken" reply
  const [slotResult, setSlotResult] = useState<SlotResult | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real visitors never see or fill this in

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // Worked out once, when the form opens — the day limits shouldn't move while someone is filling it in.
  const [{ today, maxDate }] = useState(() => {
    const now = new Date();
    return {
      today: isoDate(now),
      maxDate: isoDate(new Date(now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)),
    };
  });
  const selectedService = page.services.find((s) => s.id === serviceId) ?? null;

  // The slot list is keyed on service + day (+ a refresh nonce), so a stale
  // response for an older choice can never be shown for a newer one.
  const key = serviceId !== null && date ? `${serviceId}|${date}|${refreshNonce}` : null;

  useEffect(() => {
    if (!key || serviceId === null) return;
    let cancelled = false;
    apiFetch<{ slots: string[] }>(
      `/api/landing-pages/public/${page.slug}/availability/?service=${serviceId}&date=${date}`,
      { auth: false }
    )
      .then((result) => {
        if (!cancelled) setSlotResult({ key, slots: result.slots });
      })
      .catch((err) => {
        if (!cancelled) setSlotResult({ key, error: err instanceof ApiError ? err.message : "Couldn't load times. Try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [key, page.slug, serviceId, date]);

  const current = key !== null && slotResult?.key === key ? slotResult : null;
  const slots = current && "slots" in current ? current.slots : null;
  const slotError = current && "error" in current ? current.error : null;
  const loadingSlots = key !== null && current === null;

  function pickService(id: number | null) {
    onServiceChange(id);
    setTime(null);
  }

  function pickDate(value: string) {
    setDate(value);
    setTime(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (serviceId === null || !date || !time) {
      setError("Pick a service, a day, and a time first.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<Confirmation>(`/api/landing-pages/public/${page.slug}/book/`, {
        method: "POST",
        auth: false,
        body: {
          service: serviceId,
          date,
          time,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          address,
          city,
          state,
          zip_code: zipCode,
          website,
        },
      });
      setConfirmation(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      if (message.includes("just taken")) {
        setTime(null);
        setRefreshNonce((n) => n + 1); // reload the slots so the taken one drops off the list
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <section id="book" className="scroll-mt-20 bg-[var(--lp-bg)]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-[var(--lp-surface)] p-8 text-center shadow-lg shadow-emerald-900/5 sm:p-10">
            <span className="accent-bg mx-auto flex h-14 w-14 items-center justify-center rounded-full">
              <Check className="h-7 w-7" strokeWidth={3} />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-[var(--lp-text)]">You&apos;re booked</h2>
            <p className="mt-3 text-[var(--lp-muted)]">
              {confirmation.service} with {confirmation.business_name}
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--lp-text)]">{confirmation.when}</p>
            {page.phone && (
              <p className="mt-6 text-sm text-[var(--lp-muted)]">
                Need to change it? Call{" "}
                <a href={`tel:${page.phone}`} className="font-medium underline">
                  {page.phone}
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="book" className="scroll-mt-20 bg-[var(--lp-bg)]">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div className="lg:pt-2">
          <SectionHeader
            page={page}
            eyebrow="Online booking"
            title="Book an appointment"
            description="Pick what you need and a time that works. You'll only see times that are actually open."
          />
          {selectedService && (
            <div className="mt-8 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-alt)] p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your booking</p>
              <p className="mt-2 text-xl font-semibold text-[var(--lp-text)]">{selectedService.name}</p>
              <p className="mt-1 text-sm text-[var(--lp-muted)]">
                {formatDuration(selectedService.duration_minutes)} · {formatPrice(selectedService.price)}
              </p>
            </div>
          )}
        </div>

        <form
          onSubmit={submit}
          className={`relative space-y-10 rounded-3xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6 shadow-xl shadow-gray-900/5 ring-1 ring-black/5 sm:p-10 ${FORM_CONTROLS}`}
        >
          <fieldset className="space-y-4">
            <legend className="mb-4 text-base font-semibold text-[var(--lp-text)]">
              <StepBadge n={1} />
              Service
            </legend>
            <select
              required
              value={serviceId ?? ""}
              onChange={(e) => pickService(e.target.value ? Number(e.target.value) : null)}
              className="block w-full rounded-lg border border-[var(--lp-line)] bg-[var(--lp-surface)] px-3 py-2.5 text-sm"
            >
              <option value="" disabled>
                Choose a service
              </option>
              {page.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.duration_minutes)} · {formatPrice(s.price)}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-4 text-base font-semibold text-[var(--lp-text)]">
              <StepBadge n={2} />
              Day and time
            </legend>
            <input
              type="date"
              required
              min={today}
              max={maxDate}
              value={date}
              onChange={(e) => pickDate(e.target.value)}
              className="block w-full rounded-lg border border-[var(--lp-line)] bg-[var(--lp-surface)] px-3 py-2.5 text-sm"
            />

            <div aria-live="polite" className="min-h-[2.5rem]">
              {serviceId === null || !date ? (
                <p className="text-sm text-[var(--lp-muted)]">Choose a service and a day to see open times.</p>
              ) : loadingSlots ? (
                <p className="text-sm text-[var(--lp-muted)]">Checking open times…</p>
              ) : slotError ? (
                <p className="text-sm text-red-600">{slotError}</p>
              ) : slots && slots.length === 0 ? (
                <p className="text-sm text-[var(--lp-muted)]">No openings that day. Try another date.</p>
              ) : (
                slots && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        aria-pressed={time === slot}
                        onClick={() => setTime(slot)}
                        className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors ${
                          time === slot
                            ? "accent-bg border-transparent"
                            : "border-[var(--lp-line)] bg-[var(--lp-surface)] text-[var(--lp-text)] hover:border-[var(--lp-muted)]"
                        }`}
                      >
                        {formatClock(`${slot}:00`)}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-4 text-base font-semibold text-[var(--lp-text)]">
              <StepBadge n={3} />
              Your details
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              <Field label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <Field label="Phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              <div className="sm:col-span-2">
                <Field label="Street address" required value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
              </div>
              <Field label="City" required value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="State" required value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" />
                <Field label="Zip" required value={zipCode} onChange={(e) => setZipCode(e.target.value)} autoComplete="postal-code" />
              </div>
            </div>
          </fieldset>

          {/* Hidden from people (and from screen readers, and from Tab). Bots
              that fill in every field fill this one too, and the server drops them. */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <div className="space-y-3">
            <Button type="submit" disabled={submitting} className="w-full py-3.5 text-base">
              {submitting ? "Booking…" : "Book appointment"}
            </Button>
            <ErrorText>{error}</ErrorText>
            <p className="text-center text-xs text-[var(--lp-muted)]">
              Booking is instant. You&apos;ll get a confirmation right here.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}

// The small numbered circle in front of each step's title.
function StepBadge({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="accent-bg mr-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
      {n}
    </span>
  );
}
