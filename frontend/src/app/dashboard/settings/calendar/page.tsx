import { Settings2 } from "lucide-react";

import { Card } from "@/components/form";
import { BookingRulesSection } from "@/components/settings/BookingRulesSection";
import { CalendarColorSection } from "@/components/settings/CalendarColorSection";
import { OperatingHoursSection } from "@/components/settings/OperatingHoursSection";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

// The "Calendar" settings tab — everything that shapes how the dashboard
// Calendar widget behaves and looks: which hours it's bookable (Operating
// Hours), the booking rules layered on top (double booking, default
// view), and now its own color (Calendar Color).

export default function CalendarSettingsPage() {
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
          <OperatingHoursSection />
          <BookingRulesSection />
          <CalendarColorSection />
        </div>
      </div>
    </div>
  );
}
