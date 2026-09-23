// ----------------------------------------------------------------------------
// Shared header for top-level dashboard pages (Services, Products,
// Marketing, ...) — icon badge + title + description on the left, a
// primary action (e.g. "Add service") on the right. Mirrors the same
// icon-badge treatment already used for Settings sections
// (components/settings/SettingsSection.tsx) so the whole dashboard reads
// as one consistent visual language instead of every page inventing its
// own header.
// ----------------------------------------------------------------------------

export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="accent-bg flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
