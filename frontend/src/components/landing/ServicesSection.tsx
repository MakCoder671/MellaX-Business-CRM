import { SectionHeader } from "./SectionHeader";
import { type PublicLandingPage, formatDuration, formatPrice, landingStyle } from "./landing";

// The services the owner switched on. Each card's Book button preselects that
// service in the booking form. Products never show here, only services.
export function ServicesSection({
  page,
  canBook,
  onBook,
}: {
  page: PublicLandingPage;
  canBook: boolean;
  onBook: (serviceId: number) => void;
}) {
  if (page.services.length === 0) return null;
  const style = landingStyle(page.landing_font, page.landing_corners, page.landing_cards);

  return (
    <section id="services" className="scroll-mt-20 border-y border-[var(--lp-line)] bg-[var(--lp-alt)]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeader
          page={page}
          eyebrow="What we offer"
          title="Services"
          description="Every service shows how long it takes and what it costs, so you know what to expect before you book."
        />

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {page.services.map((service) => (
            <li
              key={service.id}
              className={`flex flex-col ${style.panel} p-7 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${style.card}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-semibold text-[var(--lp-text)]">{service.name}</h3>
                <span className="shrink-0 rounded-full bg-[var(--lp-alt)] px-3 py-1 text-xs font-semibold text-[var(--lp-muted)]">
                  {formatDuration(service.duration_minutes)}
                </span>
              </div>
              {service.description && (
                <p className="mt-3 flex-1 leading-relaxed text-[var(--lp-muted)]">{service.description}</p>
              )}
              <div className="mt-8 flex items-center justify-between border-t border-[var(--lp-line)] pt-5">
                <span className="text-3xl font-bold tracking-tight text-[var(--lp-text)]">{formatPrice(service.price)}</span>
                {canBook && (
                  <a
                    href="#book"
                    onClick={() => onBook(service.id)}
                    className={`accent-bg px-5 py-2.5 text-sm font-semibold ${style.button}`}
                  >
                    Book
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
