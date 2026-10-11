import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the little "N" dev-mode badge Next.js overlays in the corner while
  // running `next dev` — it has no effect on a real production build, it's
  // just in the way when taking screenshots for the marketing site.
  devIndicators: false,
};

export default nextConfig;
