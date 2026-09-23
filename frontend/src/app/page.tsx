import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { Hero } from "@/components/marketing/Hero";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Navbar } from "@/components/marketing/Navbar";
import { PricingStrip } from "@/components/marketing/PricingStrip";

// The marketing splash page at "/" — the very first thing a stranger
// sees. The Navbar handles "already logged in?" on its own (straight to
// the dashboard instead of the sales pitch); this page is just the pitch
// itself, broken into one component per section.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-cream text-ink">
      <Navbar />
      <Hero />
      <FeatureGrid />
      <PricingStrip />
      <MarketingFooter />
    </main>
  );
}
