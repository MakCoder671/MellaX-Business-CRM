"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ----------------------------------------------------------------------------
// A tiny sub-nav shared by both Marketing pages (E-blasts and Campaigns)
// — per the plan doc, they're both part of the same "Marketing Tools"
// feature area (e-blasts are Basic, campaigns are Plus), so they live
// under the same top-level sidebar link but get their own tabs to switch
// between the two.
// ----------------------------------------------------------------------------

const TABS = [
  { href: "/dashboard/marketing", label: "E-blasts" },
  { href: "/dashboard/marketing/campaigns", label: "Campaigns" },
];

export function MarketingTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-4 border-b border-gray-200">
      {TABS.map((tab) => {
        // Campaigns has its own nested detail route
        // (/dashboard/marketing/campaigns/<id>), so "active" means
        // "starts with this tab's path," not just an exact match.
        const active = pathname.startsWith(tab.href) && (tab.href !== "/dashboard/marketing" || pathname === tab.href);
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
