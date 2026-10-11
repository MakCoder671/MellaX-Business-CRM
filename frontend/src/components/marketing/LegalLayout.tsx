import type { ReactNode } from "react";

import { MarketingFooter } from "./MarketingFooter";
import { Navbar } from "./Navbar";

// Shared chrome for the Terms and Privacy pages — same nav/footer as the
// rest of the marketing site, with a plain readable column for the
// actual legal text. Headings/paragraphs are styled with a couple of
// small helper components below instead of pulling in a typography
// plugin just for two pages.
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col bg-cream text-ink">
      <Navbar />
      <article className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink/50">Last updated {updated}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </article>
      <MarketingFooter />
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink/70">{children}</div>
    </section>
  );
}
