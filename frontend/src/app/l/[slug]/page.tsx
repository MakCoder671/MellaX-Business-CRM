"use client";

import { use, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";

// ----------------------------------------------------------------------------
// This is the ONLY page in the whole frontend that a random stranger
// (not logged in) is meant to visit — every business's public landing
// page lives at /l/<their-slug>. It hits the backend's public,
// unauthenticated endpoint (landingpages/views.py's PublicLandingPageView)
// — notice `auth: false` below, since there's no logged-in user here at all.
// ----------------------------------------------------------------------------

// Matches exactly what the backend's PublicLandingPageSerializer sends
// back — see landingpages/serializers.py for the Django side of this shape.
type PublicLandingPage = {
  slug: string;
  business_name: string;
  blurb_text: string;
  phone: string;
  email: string;
  photos: { id: number; image: string; display_order: number }[];
  services: { name: string; description: string; price: string }[];
  booking_enabled: boolean;
};

export default function PublicLandingPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = use(params);
  const [page, setPage] = useState<PublicLandingPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PublicLandingPage>(`/api/landing-pages/public/${slug}/`, { auth: false })
      .then(setPage)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Not found."));
  }, [slug]);

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-gray-500">
        {error}
      </main>
    );
  }

  if (!page) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-gray-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <h1 className="text-3xl font-semibold">{page.business_name}</h1>
      {page.blurb_text && <p className="mt-3 text-gray-600">{page.blurb_text}</p>}

      {page.photos.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-2">
          {page.photos.map((photo) => (
            // A plain <img> instead of Next.js's <Image> component here —
            // these come straight from the Django backend (a different
            // origin than the frontend), and Next's <Image> needs extra
            // config to optimize images from external domains. Not worth
            // the setup yet for a v1 gallery.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={photo.image} alt="" className="aspect-square rounded-md object-cover" />
          ))}
        </div>
      )}

      {page.services.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Services</h2>
          <ul className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200">
            {page.services.map((service) => (
              <li key={service.name} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{service.name}</p>
                  {service.description && (
                    <p className="text-gray-500">{service.description}</p>
                  )}
                </div>
                <span className="text-gray-700">${service.price}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 text-sm text-gray-600">
        {page.phone && <p>{page.phone}</p>}
        {page.email && <p>{page.email}</p>}
      </section>
    </main>
  );
}
