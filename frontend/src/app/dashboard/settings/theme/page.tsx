import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { ThemeSection } from "@/components/settings/ThemeSection";

// The "Theme" settings tab — personalizing how the software itself looks
// (software color, background). The Calendar's own color lives on the
// Calendar tab instead, right next to the rest of the Calendar settings.

export default function ThemeSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsTabs />
      <ThemeSection />
    </div>
  );
}
