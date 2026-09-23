"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, Palette, CalendarClock } from "lucide-react";

// ----------------------------------------------------------------------------
// Settings had grown into one long scroll of six unrelated-looking
// sections — grouping them under a few labeled categories (Business /
// Theme / Calendar / Invoicing) makes it obvious at a glance where a
// given setting lives. Rendered as a vertical nav (icon + label, active
// item accent-tinted) matching the same nav-item look already used in
// the dashboard's own sidebar, rather than a plain horizontal tab strip
// — a settings page reads more like a proper "control panel" this way,
// and the icons double as a quick visual index of what's on each tab.
// ----------------------------------------------------------------------------

const TABS = [
  { href: "/dashboard/settings", label: "Business", icon: Building2 },
  { href: "/dashboard/settings/theme", label: "Theme", icon: Palette },
  { href: "/dashboard/settings/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/dashboard/settings/invoicing", label: "Invoicing", icon: CreditCard },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--accent-50,#ecfdf5)] text-[var(--accent-700,#047857)]"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                active ? "accent-bg" : "bg-gray-100 text-gray-400"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
