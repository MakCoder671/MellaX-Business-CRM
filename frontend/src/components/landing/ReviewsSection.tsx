"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, ErrorText, Field } from "@/components/form";

import { SectionHeader } from "./SectionHeader";
import { FORM_CONTROLS, type PublicLandingPage, landingStyle } from "./landing";

// Approved reviews, and a form for visitors to leave one. A new review stays
// hidden until the owner approves it, so this section says so after submitting.
export function ReviewsSection({ page, onSubmitted }: { page: PublicLandingPage; onSubmitted?: () => void }) {
  const style = landingStyle(page.landing_font, page.landing_corners, page.landing_cards);
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating === 0) {
      setError("Pick a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ detail: string }>(`/api/landing-pages/public/${page.slug}/reviews/`, {
        method: "POST",
        auth: false,
        body: { author_name: authorName, rating, text, website },
      });
      setThanks(result.detail);
      setAuthorName("");
      setRating(0);
      setText("");
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="reviews" className="scroll-mt-20 border-y border-[var(--lp-line)] bg-[var(--lp-alt)]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeader page={page} eyebrow="Reviews" title="What people say" />
          {page.average_rating !== null && (
            <div className="flex shrink-0 items-center gap-5 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] px-6 py-5 shadow-sm">
              <span className="text-5xl font-bold tracking-tight text-[var(--lp-text)]">{page.average_rating.toFixed(1)}</span>
              <div>
                <Stars value={Math.round(page.average_rating)} label={`${page.average_rating.toFixed(1)} out of 5 stars`} />
                <p className="mt-1 text-sm text-[var(--lp-muted)]">
                  from {page.review_count} review{page.review_count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          )}
        </div>

        {page.reviews.length > 0 && (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {page.reviews.map((review) => (
              <li key={review.id} className={`flex flex-col ${style.panel} p-7 ${style.card}`}>
                <Stars value={review.rating} label={`${review.rating} out of 5 stars`} />
                {review.text && <p className="mt-4 flex-1 leading-relaxed text-[var(--lp-text)]">&ldquo;{review.text}&rdquo;</p>}
                <p className="mt-6 text-sm font-semibold text-[var(--lp-text)]">{review.author_name}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <h3 className={`text-2xl leading-tight text-[var(--lp-text)] ${style.heading}`}>Been in recently?</h3>
            <p className="mt-3 text-lg leading-relaxed text-[var(--lp-muted)]">
              Share how it went. Reviews appear here once the business has approved them.
            </p>
          </div>

          <div className={`${style.panel} p-6 sm:p-8 ${style.card}`}>
            {thanks ? (
              <p className="text-[var(--lp-text)]">{thanks}</p>
            ) : (
              <form onSubmit={submit} className={`relative space-y-5 ${FORM_CONTROLS}`}>
                <Field label="Your name" required value={authorName} onChange={(e) => setAuthorName(e.target.value)} />

                <div>
                  <p className="text-sm font-medium text-[var(--lp-text)]">Your rating</p>
                  <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Star rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={rating === n}
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                        onClick={() => setRating(n)}
                        className="rounded p-1 text-amber-500 transition-transform hover:scale-110"
                      >
                        <Star className="h-7 w-7" fill={n <= rating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-sm font-medium text-[var(--lp-text)]">
                  Your review (optional)
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    className="mt-1 block w-full rounded-lg border border-[var(--lp-line)] px-3 py-2.5 text-sm shadow-sm"
                  />
                </label>

                {/* Hidden from people and skipped by Tab. Bots that fill every field fill this too. */}
                <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </label>
                </div>

                <Button type="submit" disabled={submitting} className="w-full py-3.5 text-base">
                  {submitting ? "Sending…" : "Send review"}
                </Button>
                <ErrorText>{error}</ErrorText>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Five stars, filled up to the rating. The label is for screen readers, since
// the stars themselves are just pictures.
function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <div aria-label={label} className="flex gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="h-4 w-4" fill={n <= value ? "currentColor" : "none"} aria-hidden="true" />
      ))}
    </div>
  );
}
