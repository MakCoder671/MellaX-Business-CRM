import { BrandingSection } from "@/components/settings/BrandingSection";
import { BusinessInfoSection } from "@/components/settings/BusinessInfoSection";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

// ----------------------------------------------------------------------------
// Settings is now grouped into three labeled tabs (see SettingsTabs) so
// it's obvious at a glance where a setting lives instead of scrolling
// through one long wall of cards. This page is the "Business" tab —
// who you are, how your brand looks. Calendar-related settings (Operating
// Hours, Booking Rules) live at /dashboard/settings/calendar, and
// invoicing-related ones at /dashboard/settings/invoicing.
//
// (Account & Subscription, Client Management, and Notifications are all
// listed as Fast-Follow in the plan doc's V1 Launch Scope — deliberately
// left out of this page for now.)
// ----------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsTabs />
      <BusinessInfoSection />
      <BrandingSection />
    </div>
  );
}
