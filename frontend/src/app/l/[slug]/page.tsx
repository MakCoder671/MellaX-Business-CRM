"use client";

import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { formatAddressLines } from "@/lib/address";
import { applyTheme } from "@/lib/themePresets";
import { AboutSection } from "@/components/landing/AboutSection";
import { BookingSection } from "@/components/landing/BookingSection";
import { ClosingSection } from "@/components/landing/ClosingSection";
import { GallerySection } from "@/components/landing/GallerySection";
import { LandingHeader } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { type PublicLandingPage, landingPalette, landingStyle } from "@/components/landing/landing";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { SocialLinks } from "@/components/landing/social";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { VisitSection } from "@/components/landing/VisitSection";

// ----------------------------------------------------------------------------
// The public landing page at /l/<slug>, one page with anchor links, the same
// structure as the Gatherwell demo: header, hero, about, services, gallery,
// reviews, booking (Plus only), and visit. Everything the owner set up on their
// Landing Page section shows up here. The page uses the landing page's own
// accent color, separate from the dashboard theme.
// ----------------------------------------------------------------------------

export default function PublicLandingPagePage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = use(params);
  const [page, setPage] = useState<PublicLandingPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<PublicLandingPage>(`/api/landing-pages/public/${slug}/`, { auth: false })
      .then(setPage)
      .catch((err) => setError(err instanceof ApiError ? err.message : "This page isn't available."));
  }, [slug]);

  useEffect(() => {
    if (!page) return;
    applyTheme({ theme_accent: page.landing_accent, theme_background: "default" });
    document.title = page.business_name;
  }, [page]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-6 text-center text-gray-600">
        <p>{error}</p>
      </main>
    );
  }

  if (!page) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center text-sm text-gray-500">
        Loading…
      </main>
    );
  }

  const canBook = page.booking_available;
  const style = landingStyle(page.landing_font, page.landing_corners, page.landing_cards);
  const addressLines = formatAddressLines(page);

  // The background, surface, and text colors all come from the owner's choice.
  // Setting them as CSS variables here lets every section pick them up.
  return (
    <div
      className="min-h-screen flex-1 text-[var(--lp-text)]"
      style={{ ...landingPalette(page.landing_background), background: "var(--lp-bg)" }}
    >
      <LandingHeader page={page} canBook={canBook} />

      <main className={canBook ? "pb-24 md:pb-0" : undefined}>
        <Hero page={page} canBook={canBook} />
        <AboutSection page={page} />
        <ServicesSection page={page} canBook={canBook} onBook={setServiceId} />
        <GallerySection page={page} />
        <ReviewsSection page={page} />
        {canBook && <BookingSection page={page} serviceId={serviceId} onServiceChange={setServiceId} />}
        <VisitSection page={page} />
        <ClosingSection page={page} canBook={canBook} />
      </main>

      <footer className="bg-gray-950 text-sm text-gray-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-white">{page.business_name}</p>
            {addressLines.length > 0 && <p className="mt-1">{addressLines.join(", ")}</p>}
          </div>
          <SocialLinks links={page.social_links} tone="dark" />
          <p>© {new Date().getFullYear()} {page.business_name}</p>
        </div>
      </footer>

      {canBook && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--lp-line)] bg-[var(--lp-bg)]/95 p-3 backdrop-blur md:hidden">
          <a href="#book" className={`accent-bg flex w-full justify-center py-3.5 text-base font-semibold shadow-md ${style.button}`}>
            Book an appointment
          </a>
        </div>
      )}
    </div>
  );
}
