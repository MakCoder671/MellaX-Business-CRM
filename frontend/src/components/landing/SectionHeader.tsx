import { type PublicLandingPage, landingStyle } from "./landing";

// The heading every section shares: a small accent-colored label on top, the
// title in the owner's chosen font, and an optional line underneath. Writing it
// once keeps every section lined up the same way, which is most of what makes
// a page look professionally built.
export function SectionHeader({
  page,
  eyebrow,
  title,
  description,
}: {
  page: PublicLandingPage;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  const style = landingStyle(page.landing_font, page.landing_corners, page.landing_cards);

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent-600,#059669)]">{eyebrow}</p>
      <h2 className={`mt-3 text-3xl leading-tight text-[var(--lp-text)] sm:text-4xl ${style.heading}`}>{title}</h2>
      {description && <p className="mt-4 text-lg leading-relaxed text-[var(--lp-muted)]">{description}</p>}
    </div>
  );
}
