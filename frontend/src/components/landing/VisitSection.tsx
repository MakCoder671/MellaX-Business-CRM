import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { formatAddressLines } from "@/lib/address";

import { InfoRow } from "./InfoRow";
import { SectionHeader } from "./SectionHeader";
import { SocialLinks } from "./social";
import { type PublicLandingPage, dayName, formatClock, landingStyle, mapsSearchUrl } from "./landing";

// Hours, phone, email, and the address with a directions link. This is the
// section people look for when they're deciding whether to come in or call.
export function VisitSection({ page }: { page: PublicLandingPage }) {
  const style = landingStyle(page.landing_font, page.landing_corners, page.landing_cards);
  const addressLines = formatAddressLines(page);
  // Show Monday through Sunday in order, even if the backend returned them out of order.
  const rows = [0, 1, 2, 3, 4, 5, 6].map((day) => page.hours.find((h) => h.day_of_week === day) ?? null);
  const hasHours = page.hours.length > 0;

  return (
    <section id="visit" className="scroll-mt-20 bg-[var(--lp-bg)]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeader page={page} eyebrow="Visit us" title="Hours and contact" />

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {hasHours && (
            <div className={`${style.panel} p-7 sm:p-8 ${style.card}`}>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--lp-text)]">
                <Clock className="h-5 w-5 text-gray-400" />
                Opening hours
              </h3>
              <ul className="mt-5 divide-y divide-[var(--lp-line)]">
                {rows.map((row, day) => {
                  const isOpen = row?.is_open && row.open_time && row.close_time;
                  return (
                    <li key={day} className="flex items-center justify-between py-3.5 text-sm">
                      <span className="font-medium text-[var(--lp-text)]">{dayName(day)}</span>
                      <span className={isOpen ? "font-medium text-[var(--lp-text)]" : "text-gray-400"}>
                        {isOpen ? `${formatClock(row.open_time!)} to ${formatClock(row.close_time!)}` : "Closed"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className={`${style.panel} p-7 sm:p-8 ${style.card}`}>
            <h3 className="text-lg font-semibold text-[var(--lp-text)]">Get in touch</h3>
            <ul className="mt-5 divide-y divide-[var(--lp-line)]">
              {page.phone && (
                <InfoRow icon={<Phone className="h-5 w-5" />} label="Phone">
                  <a href={`tel:${page.phone}`} className="underline-offset-4 hover:underline">
                    {page.phone}
                  </a>
                </InfoRow>
              )}
              {page.email && (
                <InfoRow icon={<Mail className="h-5 w-5" />} label="Email">
                  <a href={`mailto:${page.email}`} className="break-all underline-offset-4 hover:underline">
                    {page.email}
                  </a>
                </InfoRow>
              )}
              {addressLines.length > 0 && (
                <InfoRow icon={<MapPin className="h-5 w-5" />} label="Address">
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                  <a
                    href={mapsSearchUrl(addressLines)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-600,#059669)] hover:underline"
                  >
                    Get directions
                  </a>
                </InfoRow>
              )}
            </ul>

            {page.social_links.length > 0 && (
              <div className="mt-6 border-t border-[var(--lp-line)] pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Follow us</p>
                <SocialLinks links={page.social_links} className="mt-3" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
