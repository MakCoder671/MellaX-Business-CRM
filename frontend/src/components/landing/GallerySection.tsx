"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { SectionHeader } from "./SectionHeader";
import { type PublicLandingPage, landingStyle } from "./landing";

// The photo gallery. Photos sit in cards of six, so the 12 photo maximum makes
// two cards. Swipe, drag, or use the arrows and dots to move between cards.
// Tapping a photo opens it large in a viewer, where the arrows, swipes, and
// keyboard arrow keys move from photo to photo.

const PHOTOS_PER_CARD = 6;
// How far a finger or mouse has to travel before it counts as a swipe.
const SWIPE_DISTANCE = 50;
// Smaller than this, a press is treated as a tap and not a drag.
const DRAG_TOLERANCE = 6;

export function GallerySection({ page }: { page: PublicLandingPage }) {
  const photos = page.photos;
  const style = landingStyle(page.landing_font, page.landing_corners, page.landing_cards);

  // Split the photos into cards of six.
  const cards: (typeof photos)[] = [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_CARD) {
    cards.push(photos.slice(i, i + PHOTOS_PER_CARD));
  }
  const lastCard = cards.length - 1;

  const [cardIndex, setCardIndex] = useState(0);
  const current = Math.min(cardIndex, Math.max(lastCard, 0));
  // dragX is how far the finger has moved this card. It drives the track while dragging.
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const dragStart = useRef<number | null>(null);
  const dragMoved = useRef(false);
  const viewerStart = useRef<number | null>(null);
  const viewerMoved = useRef(false);

  function goToCard(next: number) {
    setCardIndex(Math.max(0, Math.min(lastCard, next)));
  }

  // Closing the viewer leaves the gallery on the card the last photo was on.
  function closeViewer() {
    if (openIndex !== null) setCardIndex(Math.floor(openIndex / PHOTOS_PER_CARD));
    setOpenIndex(null);
  }

  // Moves through all the photos in the viewer, wrapping at the ends.
  function stepViewer(direction: 1 | -1) {
    setOpenIndex((i) => (i === null ? i : (i + direction + photos.length) % photos.length));
  }

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowRight") stepViewer(1);
      if (e.key === "ArrowLeft") stepViewer(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // closeViewer and stepViewer only read the open photo, which is already in the list below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, photos.length]);

  // Dragging the card track. The card follows the finger, then either snaps to the
  // next card on a long enough swipe or slides back.
  function onTrackDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragStart.current = e.clientX;
    dragMoved.current = false;
    setDragging(true);
    // No pointer capture here. Capturing on press would send the click to the track
    // instead of the photo, so a tap would never open the viewer.
  }

  function onTrackMove(e: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    let dx = e.clientX - dragStart.current;
    if (Math.abs(dx) > DRAG_TOLERANCE && !dragMoved.current) {
      dragMoved.current = true;
      // Only now that it's a real drag do we keep hold of the pointer, so the card keeps following even off the track.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // At either end the track moves only a third as far, so it feels like it hit a wall.
    if ((current === 0 && dx > 0) || (current === lastCard && dx < 0)) dx = dx / 3;
    setDragX(dx);
  }

  function onTrackUp(e: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const dx = e.clientX - dragStart.current;
    dragStart.current = null;
    setDragging(false);
    setDragX(0);
    if (dx < -SWIPE_DISTANCE) goToCard(current + 1);
    else if (dx > SWIPE_DISTANCE) goToCard(current - 1);
  }

  function onTrackCancel() {
    // The browser took over (for example, the page started scrolling). Snap back, no change of card.
    dragStart.current = null;
    setDragging(false);
    setDragX(0);
  }

  // Swiping inside the viewer. The click that ends a swipe is ignored, so the viewer doesn't close by accident.
  function onViewerDown(e: PointerEvent<HTMLDivElement>) {
    viewerStart.current = e.clientX;
    viewerMoved.current = false;
  }

  function onViewerUp(e: PointerEvent<HTMLDivElement>) {
    if (viewerStart.current === null) return;
    const dx = e.clientX - viewerStart.current;
    viewerStart.current = null;
    if (Math.abs(dx) > SWIPE_DISTANCE) {
      viewerMoved.current = true;
      stepViewer(dx < 0 ? 1 : -1);
    }
  }

  if (photos.length === 0) return null;

  const from = current * PHOTOS_PER_CARD + 1;
  const to = Math.min((current + 1) * PHOTOS_PER_CARD, photos.length);

  return (
    <section id="gallery" className="scroll-mt-20 bg-[var(--lp-bg)]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeader page={page} eyebrow="Our work" title="Gallery" description="A look at recent work." />

        {/* The track holds every card side by side. Moving the track slides the cards. */}
        <div
          className="relative mt-12 overflow-hidden select-none"
          onPointerDown={onTrackDown}
          onPointerMove={onTrackMove}
          onPointerUp={onTrackUp}
          onPointerCancel={onTrackCancel}
        >
          <div
            className="flex touch-pan-y cursor-grab transition-transform duration-500 ease-out active:cursor-grabbing motion-reduce:transition-none"
            style={{
              transform: `translateX(calc(${-current * 100}% + ${dragX}px))`,
              transitionDuration: dragging ? "0ms" : undefined,
            }}
          >
            {cards.map((group, cardNumber) => (
              <div key={cardNumber} className="w-full shrink-0" inert={cardNumber !== current}>
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
                  {group.map((photo, i) => {
                    const index = cardNumber * PHOTOS_PER_CARD + i;
                    return (
                      <li key={photo.id}>
                        <button
                          type="button"
                          onClick={() => {
                            // A drag that ends on a photo isn't a click.
                            if (!dragMoved.current) setOpenIndex(index);
                          }}
                          aria-label={`Open photo ${index + 1} of ${photos.length}`}
                          className={`group block w-full cursor-zoom-in overflow-hidden bg-[var(--lp-alt)] shadow-sm ${style.image}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.image}
                            alt=""
                            draggable={false}
                            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {cards.length > 1 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => goToCard(current - 1)}
                disabled={current === 0}
                aria-label="Previous photos"
                className="rounded-full border border-[var(--lp-line)] bg-[var(--lp-surface)] p-2.5 text-[var(--lp-text)] transition hover:bg-[var(--lp-alt)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                {cards.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToCard(i)}
                    aria-label={`Show photos ${i * PHOTOS_PER_CARD + 1} to ${Math.min((i + 1) * PHOTOS_PER_CARD, photos.length)}`}
                    aria-current={i === current}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      i === current ? "accent-bg w-8" : "w-2.5 bg-[var(--lp-line)] hover:bg-[var(--lp-muted)]"
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => goToCard(current + 1)}
                disabled={current === lastCard}
                aria-label="Next photos"
                className="rounded-full border border-[var(--lp-line)] bg-[var(--lp-surface)] p-2.5 text-[var(--lp-text)] transition hover:bg-[var(--lp-alt)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <p className="text-center text-sm text-[var(--lp-muted)]">
              Showing {from} to {to} of {photos.length}
            </p>
          </div>
        )}
      </div>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${page.business_name} photos`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onPointerDown={onViewerDown}
          onPointerUp={onViewerUp}
          onClick={() => {
            // The click that ends a swipe doesn't close the viewer.
            if (viewerMoved.current) {
              viewerMoved.current = false;
              return;
            }
            closeViewer();
          }}
        >
          <button
            type="button"
            onClick={closeViewer}
            aria-label="Close photo"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepViewer(-1);
                }}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-6"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepViewer(1);
                }}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-6"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          <figure className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* The key makes React swap the image each time, so the fade plays on every change. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={openIndex}
              src={photos[openIndex].image}
              alt=""
              draggable={false}
              className="lp-fade-in h-auto max-h-[78vh] w-[min(92vw,1100px)] rounded-xl object-contain select-none"
            />
            <figcaption className="mt-3 text-sm text-white/70">
              {openIndex + 1} of {photos.length}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
