import { SectionHeader } from "./SectionHeader";
import type { PublicLandingPage } from "./landing";

// The owner's bio. Heading on the left, the story on the right, so the section
// reads like a proper "who we are" block and not a centered paragraph.
export function AboutSection({ page }: { page: PublicLandingPage }) {
  if (!page.blurb_text) return null;

  return (
    <section id="about" className="scroll-mt-20 bg-[var(--lp-bg)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <SectionHeader page={page} eyebrow="About" title="Who we are" />
        <p className="whitespace-pre-line text-lg leading-relaxed text-[var(--lp-muted)] lg:pt-3">{page.blurb_text}</p>
      </div>
    </section>
  );
}
