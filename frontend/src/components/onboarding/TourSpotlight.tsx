"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/form";
import { useTour } from "./TourContext";

// ----------------------------------------------------------------------------
// Renders the glowing ring + callout bubble for whichever tour step is
// currently active (see TourContext.tsx). Mounted ONCE in dashboard/layout.tsx
// so it keeps working across a Settings -> Services -> Clients navigation
// without being re-added to every page — it just looks, on whatever page
// happens to be mounted right now, for the [data-tour-id] the active step
// wants to point at.
//
// Finding the target is a short retry loop, not a one-shot querySelector:
// right after a route change the destination page hasn't fetched/rendered
// its real content yet, so the element may not exist in the DOM for the
// first render or two. If it's still missing after ~2 seconds, something's
// off (bad targetId, or the user wandered somewhere else) — better to
// quietly end the tour than leave an invisible "active" tour pointing at
// nothing forever.
// ----------------------------------------------------------------------------

const MAX_FIND_ATTEMPTS = 14; // ~2.1s total at 150ms apart
const FIND_INTERVAL_MS = 150;
const REMEASURE_INTERVAL_MS = 400; // cheap fallback that catches layout shifts (async content loading in) without a ResizeObserver per target
const CALLOUT_WIDTH = 288; // matches w-72 below
const CALLOUT_GAP = 12;
const ESTIMATED_CALLOUT_HEIGHT = 200; // rough, just enough to decide "does this fit below the target" — padded a bit above the typical rendered height (title + description + footer) so a 2-step tour's counter row doesn't push the real height past the estimate

type Rect = { top: number; left: number; width: number; height: number };

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// Tags a measured rect with the targetId it was measured for, so a stale
// rect from the PREVIOUS step can never render against the current one —
// render-time code below just checks the tag matches instead of the effect
// needing to synchronously clear it out the moment targetId changes.
type Measured = { targetId: string; rect: Rect } | null;

export function TourSpotlight() {
  const { active, currentStep, totalSteps, nextStep, endTour } = useTour();
  const pathname = usePathname();
  const router = useRouter();
  const [measured, setMeasured] = useState<Measured>(null);
  const attemptsRef = useRef(0);
  // Whether the CURRENT target has ever actually been found — lets the
  // remeasure effect below tell "not found yet" (still retrying, fine)
  // apart from "was here, now it's gone" (the action it pointed at
  // already happened, e.g. clicking Checkout swaps that whole panel for
  // the invoice form) without the two effects racing each other.
  const foundRef = useRef(false);
  const targetId = currentStep?.targetId ?? null;
  const rect = measured && measured.targetId === targetId ? measured.rect : null;

  // Most tours never need this — every step so far lived on one page (or
  // moved between modals on the same page), so clicking Next just moved
  // the ring. The settings tour is the first to cross real routes mid-
  // tour (Theme -> Calendar -> Invoicing), so a step carrying an `href`
  // gets navigated to here if the browser isn't already there; the find
  // effect below's retry loop then just waits out the new page loading.
  useEffect(() => {
    if (currentStep?.href && currentStep.href !== pathname) router.push(currentStep.href);
  }, [currentStep, pathname, router]);

  // Look for the current step's target, retrying for a couple seconds to
  // give a freshly-navigated-to page time to render it.
  useEffect(() => {
    if (!targetId) return;
    const id = targetId; // narrows to `string` for the closure below — TS can't carry the guard above into a nested function
    attemptsRef.current = 0;
    foundRef.current = false;
    let cancelled = false;

    function tryFind() {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour-id="${id}"]`);
      if (el) {
        foundRef.current = true;
        // The invoice walkthrough is a long, scrollable form — later
        // steps' targets (payment, footer buttons) start off-screen more
        // often than not, so each new step scrolls its target into view
        // rather than silently pointing at something the user can't see
        // without scrolling themselves first.
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setMeasured({ targetId: id, rect: measure(el) });
        return;
      }
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_FIND_ATTEMPTS) {
        endTour();
        return;
      }
      window.setTimeout(tryFind, FIND_INTERVAL_MS);
    }
    tryFind();

    return () => {
      cancelled = true;
    };
    // endTour is stable (useCallback in TourContext); only re-run this
    // search when the step or the route actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, pathname]);

  // Once found, keep the ring glued to the target through scrolling,
  // resizing, or anything else nearby shifting around.
  useEffect(() => {
    if (!targetId) return;
    const id = targetId; // narrows to `string` for the closure below — TS can't carry the guard above into a nested function

    function remeasure() {
      const el = document.querySelector(`[data-tour-id="${id}"]`);
      if (el) {
        setMeasured({ targetId: id, rect: measure(el) });
      } else if (foundRef.current) {
        // It WAS here and now it's gone without a route change — the
        // click it was pointing at already did its job (e.g. Checkout
        // swapping the panel for the invoice form). Nothing left to
        // point at, so the tour's done rather than left stuck on an
        // empty ring.
        endTour();
      }
    }

    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    const interval = window.setInterval(remeasure, REMEASURE_INTERVAL_MS);

    return () => {
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
      window.clearInterval(interval);
    };
  }, [targetId, endTour]);

  if (!active || !currentStep || !rect) return null;

  const stepNumber = active.stepIndex + 1;
  const isLast = stepNumber >= totalSteps;

  // Callout sits below the target by default, flips above it when there's
  // not enough room underneath. Clamped horizontally so it can't run off
  // the edge of a narrow phone screen.
  const spaceBelow = window.innerHeight - rect.top - rect.height;
  const placeAbove = spaceBelow < ESTIMATED_CALLOUT_HEIGHT && rect.top > ESTIMATED_CALLOUT_HEIGHT;
  const top = placeAbove ? rect.top - CALLOUT_GAP : rect.top + rect.height + CALLOUT_GAP;
  const left = Math.min(Math.max(rect.left, 16), window.innerWidth - CALLOUT_WIDTH - 16);

  return (
    <>
      {/* The ring — pointer-events-none so it never blocks a click on the
          real element underneath it (the point is to guide a click there,
          not get in the way of one). */}
      <div
        className="pointer-events-none fixed z-[60] rounded-lg transition-all duration-200"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow:
            "0 0 0 2px var(--accent-500, #10b981), 0 0 0 6px color-mix(in srgb, var(--accent-500, #10b981) 25%, transparent)",
        }}
      />
      <div
        className={`fixed z-[60] w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-xl transition-all duration-200 ${
          placeAbove ? "-translate-y-full" : ""
        }`}
        style={{ top, left }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{currentStep.title}</p>
          <button
            onClick={endTour}
            aria-label="Skip tour"
            className="shrink-0 rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{currentStep.description}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          {totalSteps > 1 && (
            <span className="text-xs text-gray-400">
              {stepNumber} of {totalSteps}
            </span>
          )}
          {/* autoAdvance steps complete via the real click elsewhere on
              the page (see TourContext.tsx) — a button here would just be
              a second, redundant way to advance that doesn't match what
              the copy actually asked the user to do. */}
          {!currentStep.autoAdvance && (
            <Button onClick={nextStep} className="ml-auto">
              {isLast ? "Got it" : "Next"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
