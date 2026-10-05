import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// Shared header for every Settings section — icon badge, title,
// description — so all nine sections (Business Info, Branding, Theme,
// Operating Hours, ...) share one consistent, modern look instead of
// each one hand-rolling its own "<h2> + <p>" inside a plain Card. Visual
// changes to that shared header (spacing, icon treatment, etc.) now only
// need to happen in one place.
// ----------------------------------------------------------------------------

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  tourId,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  // Lets the Getting Started > Customize your settings tour (see
  // components/onboarding/TourContext.tsx) point at this specific
  // section, the same way data-tour-id is used everywhere else in that
  // feature — plumbed through here since SettingsSection is a shared
  // wrapper, not something each section renders its own outer Card for.
  //
  // Applied to the HEADER below, not the whole Card: some sections (the
  // Theme color grid, Operating Hours' 7 day rows) are taller than the
  // viewport, and the tour's tooltip positions itself off the target's
  // bottom edge — ringing the compact header keeps that math sane
  // regardless of how long the section's actual content runs.
  tourId?: string;
}) {
  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-3" data-tour-id={tourId}>
        <span className="accent-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}
