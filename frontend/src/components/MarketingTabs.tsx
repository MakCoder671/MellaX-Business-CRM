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
    <div className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
      {TABS.map((tab) => {
        // Campaigns has its own nested detail route
        // (/dashboard/marketing/campaigns/<id>), so "active" means
        // "starts with this tab's path," not just an exact match.
        const active = pathname.startsWith(tab.href) && (tab.href !== "/dashboard/marketing" || pathname === tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
