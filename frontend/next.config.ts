import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the little "N" dev-mode badge Next.js overlays in the corner while
  // running `next dev` — it has no effect on a real production build, it's
  // just in the way when taking screenshots for the marketing site.
  devIndicators: false,
  // `next dev` only trusts localhost by default. Opening the app at
  // http://127.0.0.1:3000 instead blocks its dev JS from loading, so React
  // never hydrates and the login form falls back to a plain page reload
  // ("/login?") instead of actually logging in. Dev-only; no effect on builds.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
