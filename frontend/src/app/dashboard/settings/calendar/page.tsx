import { BookingRulesSection } from "@/components/settings/BookingRulesSection";
import { OperatingHoursSection } from "@/components/settings/OperatingHoursSection";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

// The "Calendar" settings tab — everything that shapes how the dashboard
// Calendar widget behaves: which hours it's bookable (Operating Hours)
// and the booking rules layered on top (double booking, default view).

export default function CalendarSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsTabs />
      <OperatingHoursSection />
      <BookingRulesSection />
    </div>
  );
}
