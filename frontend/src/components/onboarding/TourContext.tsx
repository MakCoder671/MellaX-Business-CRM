"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// ----------------------------------------------------------------------------
// Backs the "point at the exact field" tours launched from the Getting
// Started checklist (see ../GettingStarted.tsx). A checklist item doesn't
// just link to a page anymore — it also starts a tour here, which
// TourSpotlight.tsx (mounted once in dashboard/layout.tsx) reads to know
// what to point at, regardless of which page is currently showing.
//
// Lives as a Context mounted in the dashboard layout specifically because
// that's the one component that does NOT remount between e.g. Settings and
// Services — a plain useState inside GettingStarted itself would be wiped
// out the moment the Link navigated away from the Overview page.
//
// Each tour is just an ordered list of steps; a step is a DOM target (via
// data-tour-id, set on the real element in its own file) plus the copy to
// show while pointing at it. WHICH STEP is active stays plain in-memory
// state (no localStorage) — a tour is a short, in-the-moment thing, and a
// hard refresh mid-tour simply clearing it is an acceptable, simpler
// trade-off than persisting something this transient. Whether a tour has
// ever been FINISHED, though, is written to localStorage (see nextStep()
// below) — some checklist items (the "settings" tour) don't have any real
// account data to check for "done," so completing the tour itself is the
// only honest signal there is.
// ----------------------------------------------------------------------------

export type TourStep = {
  targetId: string;
  title: string;
  description: string;
  // Most steps advance when the user clicks the tooltip's own Next/Got it
  // button. A step flagged autoAdvance instead completes when the user
  // performs the REAL action elsewhere on the page (e.g. clicking an
  // appointment on the calendar) — that real click handler calls
  // nextStep() itself (see Calendar.tsx), so TourSpotlight skips rendering
  // a manual button for it that wouldn't actually do anything.
  autoAdvance?: boolean;
  // Only needed when this step's target lives on a different PAGE than
  // the step before it (see the settings tour) — every earlier tour
  // stayed on one route (or moved between modals on the same route), so
  // clicking Next never had to navigate anywhere on its own; the
  // checklist's own link click was the only navigation involved.
  // TourSpotlight.tsx pushes to this route when a step carrying one
  // becomes active and the browser isn't already there.
  href?: string;
};

export const TOURS: Record<string, TourStep[]> = {
  branding: [
    {
      targetId: "business-name-field",
      title: "Add your business name",
      description:
        "This feeds straight into your invoices, your public landing page, and marketing emails. Update it once here and it shows up everywhere.",
    },
    {
      targetId: "logo-upload",
      title: "Upload your logo",
      description:
        "Shows up on invoices, your landing page, marketing emails, and the sidebar right here. It displays as a square, so a square image looks cleanest.",
    },
  ],
  service: [
    {
      targetId: "add-service-button",
      title: "Add your first service",
      description:
        "Click here to add what you charge for. This is what you'll pick from when booking an appointment or creating an invoice.",
    },
  ],
  client: [
    {
      targetId: "add-client-button",
      title: "Add your first client",
      description:
        "Click here to add a client. Their contact info, appointments, and invoices all live on one profile from then on.",
    },
  ],
  product: [
    {
      targetId: "add-product-button",
      title: "Add your first product",
      description:
        "Click here to add something you sell. Products show up on invoices alongside services, and track stock as you sell them.",
    },
  ],
  appointment: [
    {
      targetId: "add-appointment-button",
      title: "Schedule an appointment",
      description: "Click here to book a client in. This is what shows up on your calendar and feeds into their invoice.",
    },
  ],
  invoice: [
    {
      targetId: "appointment-block",
      title: "Open your appointment",
      description: "Click it to check out and create the invoice.",
      autoAdvance: true,
    },
    {
      targetId: "checkout-button",
      title: "Check out to create the invoice",
      description: "This opens the invoice for this appointment.",
      autoAdvance: true,
    },
    {
      targetId: "invoice-header",
      title: "This is the invoice",
      description:
        "Everything for this appointment goes here: what you did, any discount, and how they're paying. Save it and it's ready to print, email, or hand to your client.",
    },
    {
      targetId: "invoice-line-items",
      title: "Line items",
      description:
        "Pick the service or product, set the quantity, and the price locks in automatically from what you charge for it. Add a discount here if just this one line needs a markdown.",
    },
    {
      targetId: "invoice-discount",
      title: "Discount the whole invoice",
      description:
        "Different from the line discount above, this one knocks a flat amount or percent off the entire invoice. Set these up ahead of time in Settings > Invoicing.",
    },
    {
      targetId: "invoice-notes",
      title: "Add a note",
      description: "Optional. Shows up right on the invoice, good for a reference number or anything specific to this job.",
    },
    {
      targetId: "invoice-record-payment",
      title: "Record a payment",
      description:
        "This is how you record that payment was received, not a way to actually process payments. Leave it blank to save the invoice with an open balance and collect payment later.",
    },
    {
      targetId: "invoice-options",
      title: "Save it",
      description:
        "Quote saves it as a non-binding estimate. Otherwise, save it as a real invoice, paid in full or with a balance still due.",
      autoAdvance: true,
    },
    {
      targetId: "invoice-view-edit",
      title: "Edit",
      description:
        "Turns the invoice into something you can change. Nothing gets erased outright, editing or removing a line item keeps the old one crossed out for the record and adds the correction next to it.",
    },
    {
      targetId: "invoice-view-record-payment",
      title: "Record Payment",
      description:
        "Add a payment any time after the invoice is saved. Works the same as the payment step during creation, just for whenever the money actually comes in.",
    },
    {
      targetId: "invoice-view-refund",
      title: "Refund",
      description:
        "This is how you record a refund that's already been given, not a way to actually send money back. Pick what it's for, how much, and how it was refunded.",
    },
    {
      targetId: "invoice-view-print",
      title: "Print",
      description: "Opens a clean, printable version of this invoice.",
    },
    {
      targetId: "invoice-view-email",
      title: "Email",
      description: "Sends this invoice straight to the client's email on file.",
    },
    {
      targetId: "invoice-view-client-profile",
      title: "Client profile",
      description: "Jumps to this client's profile, where every invoice, appointment, and note about them lives in one place.",
    },
    {
      targetId: "invoice-view-delete",
      title: "Delete",
      description:
        "Only here for the first 24 hours after creating an invoice. After that it locks for good, and one that was never paid also flips to Void automatically, kept for the record instead of deleted.",
    },
  ],
  settings: [
    {
      targetId: "settings-theme",
      title: "Pick a look",
      description: "Background and button color, pre-made presets only, no color-blending required.",
      href: "/dashboard/settings/theme",
    },
    {
      targetId: "settings-timezone",
      title: "Set your time zone",
      description:
        "Everything else on this tab (hours, appointment times) is interpreted against this, daylight saving included. Set it before Operating Hours below.",
      href: "/dashboard/settings/calendar",
    },
    {
      targetId: "settings-operating-hours",
      title: "Set your hours",
      description: "This is what the Calendar shows as open or \"Off\" for each day.",
      href: "/dashboard/settings/calendar",
    },
    {
      targetId: "settings-booking-rules",
      title: "Booking rules",
      description: "Whether two clients can land in the same time slot, and which view the Calendar opens to.",
      href: "/dashboard/settings/calendar",
    },
    {
      targetId: "settings-calendar-color",
      title: "Calendar color",
      description: "Separate from your software theme. Colors appointments and the today highlight on the Calendar.",
      href: "/dashboard/settings/calendar",
    },
    {
      targetId: "settings-invoice-settings",
      title: "Set your tax rates",
      description:
        "Service and product tax percentages, auto calculated onto every new invoice. Also where the invoice number prefix and default terms live.",
      href: "/dashboard/settings/invoicing",
    },
    {
      targetId: "settings-tender-types",
      title: "Tender types",
      description: "How payments are received. This is the same list that fills the Record Payment dropdown on an invoice.",
      href: "/dashboard/settings/invoicing",
    },
    {
      targetId: "settings-discounts",
      title: "Discounts",
      description: "Reusable discounts, the same list behind the whole-invoice discount dropdown when building an invoice.",
      href: "/dashboard/settings/invoicing",
    },
  ],
};

type ActiveTour = { tourId: string; stepIndex: number };

type TourContextValue = {
  active: ActiveTour | null;
  currentStep: TourStep | null;
  totalSteps: number;
  startTour: (tourId: string) => void;
  nextStep: () => void;
  endTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

// Exported so GettingStarted.tsx can read the same key back for a tour
// whose checklist item has no real account data to check "done" against
// (see the settings tour) — mirrors readDismissed()'s try/catch-and-
// fall-back-quietly shape for the same reason (private browsing, etc).
export function readTourCompleted(tourId: string): boolean {
  try {
    return window.localStorage.getItem(`mellax_tour_completed_${tourId}`) === "true";
  } catch {
    return false;
  }
}

function markTourCompleted(tourId: string) {
  try {
    window.localStorage.setItem(`mellax_tour_completed_${tourId}`, "true");
  } catch {
    // Fine to silently ignore — worst case, that one checklist item just
    // doesn't check itself off, which isn't harmful.
  }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveTour | null>(null);

  const startTour = useCallback((tourId: string) => {
    if (!TOURS[tourId]?.length) return; // unknown tour id — nothing to start, fail quietly rather than throwing
    setActive({ tourId, stepIndex: 0 });
  }, []);

  const endTour = useCallback(() => setActive(null), []);

  const nextStep = useCallback(() => {
    setActive((current) => {
      if (!current) return current;
      const steps = TOURS[current.tourId] ?? [];
      const nextIndex = current.stepIndex + 1;
      if (nextIndex >= steps.length) {
        markTourCompleted(current.tourId); // finished naturally (not skipped) — see readTourCompleted above
        return null;
      }
      return { ...current, stepIndex: nextIndex };
    });
  }, []);

  const steps = active ? TOURS[active.tourId] ?? [] : [];
  const currentStep = active ? steps[active.stepIndex] ?? null : null;

  const value = useMemo<TourContextValue>(
    () => ({ active, currentStep, totalSteps: steps.length, startTour, nextStep, endTour }),
    [active, currentStep, steps.length, startTour, nextStep, endTour]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
