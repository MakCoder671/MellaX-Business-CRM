import { DiscountsSection } from "@/components/settings/DiscountsSection";
import { InvoiceSettingsSection } from "@/components/settings/InvoiceSettingsSection";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { TenderTypesSection } from "@/components/settings/TenderTypesSection";

// The "Invoicing" settings tab — tax rates and defaults, plus the two
// lists an invoice draws from when it's built: Tender Types and Discounts.

export default function InvoicingSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsTabs />
      <InvoiceSettingsSection />
      <TenderTypesSection />
      <DiscountsSection />
    </div>
  );
}
