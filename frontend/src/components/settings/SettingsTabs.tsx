"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ----------------------------------------------------------------------------
// Settings had grown into one long scroll of six unrelated-looking
// sections — grouping them under a few labeled categories (Business /
// Calendar / Invoicing) makes it obvious at a glance where a given
// setting lives, instead of hunting through a wall of cards. Same
// tabs-as-routes pattern as MarketingTabs.
// ----------------------------------------------------------------------------

const TABS = [
  { href: "/dashboard/settings", label: "Business" },
  { href: "/dashboard/settings/calendar", label: "Calendar" },
  { href: "/dashboard/settings/invoicing", label: "Invoicing" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-4 border-b border-gray-200">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
              active ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
