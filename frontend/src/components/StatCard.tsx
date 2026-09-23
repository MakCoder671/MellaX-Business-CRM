import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// A single at-a-glance number in a stat row (e.g. "12 services", "$4,300
// total value"). Kept deliberately simple — an icon, a label, a value —
// so a page can drop 2-4 of these in a row without each one needing its
// own bespoke markup. `tone` picks the icon badge color: "accent" ties
// it to the account's theme color (same as buttons/PageHeader), "warn"
// is a fixed amber for things like a low-stock count where the number
// itself is a caution regardless of what theme color is picked.
// ----------------------------------------------------------------------------

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "accent",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: React.ReactNode;
  tone?: "accent" | "warn" | "neutral";
}) {
  return (
    <Card className="flex items-center gap-3 rounded-2xl p-4 shadow-sm">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          tone === "accent" ? "accent-bg" : tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}
