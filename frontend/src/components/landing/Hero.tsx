"use client";

import { useSyncExternalStore } from "react";
import { Clock, MapPin, Phone, Star } from "lucide-react";

import { formatAddressLines } from "@/lib/address";

import { InfoRow } from "./InfoRow";
import { type PublicLandingPage, formatClock, landingStyle, mapsSearchUrl, openStatus } from "./landing";

// The top of the page. The business name leads, a short tagline sits under it,
// and the buttons come next. The card on the right answers what visitors want to
// know without scrolling: is it open now, where is it, and how do I reach them.
// No photo. The look comes from the accent color, type style, and corner style.

// The clock ticks once a minute, so "Open now" stays correct while someone has
// the page open. On the server there's no clock, so nothing is shown until the
// page loads in the browser. That keeps server and browser markup identical.
const subscribeMinute = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);

export function Hero({ page, canBook }: { page: PublicLandingPage; canBook: boolean }) {
  const style = landingStyle(page.landing_font, page.landing_corners, page.landing_cards);
  const minuteStamp = useSyncExternalStore(subscribeMinute, currentMinute, () => null);
  const status = minuteStamp === null ? null : openStatus(page.hours, page.time_zone, new Date(minuteStamp * 60_000));
  const addressLines = formatAddressLines(page);
  const tagline = page.blurb_text.split(/(?<=[.!?])\s/)[0] ?? "";

  return (
    <section id="top" className="relative scroll-mt-20 overflow-hidden bg-[var(--lp-bg)]">
      {/* A soft accent glow behind the top of the page. It's decoration only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[56rem] -translate-x-1/2 rounded-full bg-[var(--accent-500,#10b981)]/20 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div>
          {page.review_count > 0 && page.average_rating !== null && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-line)] bg-[var(--lp-surface)] px-3.5 py-1.5 text-sm text-[var(--lp-muted)] shadow-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-[var(--lp-text)]">{page.average_rating.toFixed(1)}</span>
              from {page.review_count} review{page.review_count === 1 ? "" : "s"}
            </span>
          )}

          {/* The top heading is the business name as text, or the logo when the owner picked it.
              With no logo uploaded yet, the name shows instead so the heading is never empty. */}
          <h1 className={`mt-6 text-5xl leading-[1.05] tracking-tight text-[var(--lp-text)] sm:text-6xl lg:text-7xl ${style.heading}`}>
            {page.hero_mark === "logo" && page.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.logo}
                alt={page.business_name}
                className="max-h-28 w-auto max-w-[18rem] object-contain object-left sm:max-h-36 sm:max-w-[24rem]"
              />
            ) : (
              page.business_name
            )}
          </h1>
          {tagline && <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--lp-muted)] sm:text-xl">{tagline}</p>}

          <div className="mt-10 flex flex-wrap gap-3">
            {canBook ? (
              <a href="#book" className={`accent-bg px-8 py-3.5 text-base font-semibold shadow-lg shadow-black/5 ${style.button}`}>
                Book an appointment
              </a>
            ) : (
              page.phone && (
                <a href={`tel:${page.phone}`} className={`accent-bg px-8 py-3.5 text-base font-semibold shadow-lg shadow-black/5 ${style.button}`}>
                  Call {page.phone}
                </a>
              )
            )}
            {page.services.length > 0 && (
              <a
                href="#services"
                className={`border border-[var(--lp-line)] bg-[var(--lp-surface)] px-8 py-3.5 text-base font-semibold text-[var(--lp-text)] hover:border-[var(--lp-muted)] hover:bg-[var(--lp-alt)] ${style.button}`}
              >
                View services
              </a>
            )}
          </div>
        </div>

        <aside className={`border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6 shadow-2xl shadow-gray-900/10 ring-1 ring-black/5 sm:p-8 ${style.card}`}>
          <div
            aria-live="polite"
            className="inline-flex min-h-8 items-center gap-2 rounded-full bg-[var(--lp-alt)] px-3.5 py-1.5 text-sm font-semibold"
          >
            {status ? (
              <>
                <span className={`h-2.5 w-2.5 rounded-full ${status.open ? "bg-emerald-500" : "bg-gray-300"}`} />
                <span className="text-[var(--lp-text)]">{status.label}</span>
              </>
            ) : (
              <span className="text-gray-400">&nbsp;</span>
            )}
          </div>

          <ul className="mt-6 divide-y divide-[var(--lp-line)]">
            {page.phone && (
              <InfoRow icon={<Phone className="h-5 w-5" />} label="Phone">
                <a href={`tel:${page.phone}`} className="hover:underline">
                  {page.phone}
                </a>
              </InfoRow>
            )}
            {addressLines.length > 0 && (
              <InfoRow icon={<MapPin className="h-5 w-5" />} label="Address">
                <a href={mapsSearchUrl(addressLines)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </a>
              </InfoRow>
            )}
            {page.hours.length > 0 && (
              <InfoRow icon={<Clock className="h-5 w-5" />} label="Hours">
                {hoursSummary(page)}
              </InfoRow>
            )}
          </ul>

          {canBook && (
            <a href="#book" className={`accent-bg mt-8 block w-full py-3.5 text-center text-base font-semibold ${style.button}`}>
              Book a time
            </a>
          )}
        </aside>
      </div>
    </section>
  );
}

// One line for the card: the weekday range that's open, like "Mon to Fri · 9:00 AM to 5:00 PM".
function hoursSummary(page: PublicLandingPage) {
  const openDays = page.hours.filter((h) => h.is_open && h.open_time && h.close_time);
  if (openDays.length === 0) return "Hours by appointment";
  const first = openDays[0];
  const same = openDays.every((h) => h.open_time === first.open_time && h.close_time === first.close_time);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = openDays.map((h) => names[h.day_of_week]);
  const range = days.length > 1 && days.every((_, i) => i === 0 || openDays[i].day_of_week === openDays[i - 1].day_of_week + 1)
    ? `${days[0]} to ${days[days.length - 1]}`
    : days.join(", ");
  return same
    ? `${range} · ${formatClock(first.open_time!)} to ${formatClock(first.close_time!)}`
    : `${range} · hours vary`;
}
