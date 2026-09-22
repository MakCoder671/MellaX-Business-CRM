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
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsTabs />
      <OperatingHoursSection />
      <BookingRulesSection />
      <CalendarColorSection />
    </div>
  );
}
