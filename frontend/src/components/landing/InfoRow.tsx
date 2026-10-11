import type { ReactNode } from "react";

// One line in a contact or hours card: a soft icon tile, a small label, and the
// value underneath. Used by the hero card and the visit section so both read the
// same way.
export function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--lp-alt)] text-[var(--lp-muted)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <div className="mt-1 text-base font-medium text-[var(--lp-text)]">{children}</div>
      </div>
    </li>
  );
}
