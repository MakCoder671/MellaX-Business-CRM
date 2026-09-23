import { Settings2 } from "lucide-react";

import { Card } from "@/components/form";
import { BrandingSection } from "@/components/settings/BrandingSection";
import { BusinessInfoSection } from "@/components/settings/BusinessInfoSection";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

// ----------------------------------------------------------------------------
// Settings is now grouped into four labeled sections (see SettingsTabs,
// rendered here as a left-hand nav card) so it's obvious at a glance
// where a setting lives instead of scrolling through one long wall of
// cards. This page is the "Business" tab — who you are, how your brand
// looks. Calendar-related settings (Operating Hours, Booking Rules) live
// at /dashboard/settings/calendar, and invoicing-related ones at
// /dashboard/settings/invoicing.
//
// (Account & Subscription, Client Management, and Notifications are all
// listed as Fast-Follow in the plan doc's V1 Launch Scope — deliberately
// left out of this page for now.)
// ----------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
          <Settings2 className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your business profile, branding, calendar, and invoicing.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit rounded-2xl p-3 shadow-sm lg:sticky lg:top-6">
          <SettingsTabs />
        </Card>
        <div className="space-y-6">
          <BusinessInfoSection />
          <BrandingSection />
        </div>
      </div>
    </div>
  );
}
