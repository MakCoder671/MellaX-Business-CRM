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
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-3">
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
