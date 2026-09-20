import { BrandingSection } from "@/components/settings/BrandingSection";
import { BusinessInfoSection } from "@/components/settings/BusinessInfoSection";
import { DiscountsSection } from "@/components/settings/DiscountsSection";
import { InvoiceSettingsSection } from "@/components/settings/InvoiceSettingsSection";
import { OperatingHoursSection } from "@/components/settings/OperatingHoursSection";
import { TenderTypesSection } from "@/components/settings/TenderTypesSection";

// ----------------------------------------------------------------------------
// The Settings page itself is intentionally thin — it doesn't need
// "use client" or any hooks of its own, because all the actual logic
// (forms, API calls, state) lives inside each section component. This
// page's only job is laying them out in order, matching the Must-Ship
// Settings scope from business_plan.MD: Business Information, Operating
// Hours, Invoice Settings (tax/Tender Types/Discounts), and Branding.
//
// (Account & Subscription, Booking Rules, Client Management, and
// Notifications are all listed as Fast-Follow or Plus in the plan doc's
// V1 Launch Scope — deliberately left out of this page for now.)
// ----------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <BusinessInfoSection />
      <BrandingSection />
      <OperatingHoursSection />
      <InvoiceSettingsSection />
      <TenderTypesSection />
      <DiscountsSection />
    </div>
  );
}
