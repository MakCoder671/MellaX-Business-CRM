import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/lib/auth-context";

// ----------------------------------------------------------------------------
// In Next.js's App Router, layout.tsx at the root of app/ wraps EVERY
// page in the whole site — it's the one place that always renders,
// no matter what URL someone's on. That makes it the right spot for
// things every page needs: the <html>/<body> tags, fonts, and here,
// wrapping everything in <AuthProvider> so any page can check "is
// someone logged in?" via the useAuth() hook.
// ----------------------------------------------------------------------------

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Bold display face used for marketing/auth headlines (see
// `font-display` in globals.css's @theme block) — the rest of the app
// (dashboard, forms) stays on Geist Sans via `font-sans`.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

// Next.js reads this and automatically fills in the page's <title> and
// meta description tags — no need to hand-write <head> HTML ourselves.
export const metadata: Metadata = {
  title: "MellaX — CRM for solo businesses, without the enterprise price tag",
  description:
    "Clients, invoicing, scheduling, and marketing in one simple CRM built for solo founders and small service businesses — starting at $9.99/mo.",
};

// LayoutProps<"/"> is a Next.js 16 typed-routes helper — it knows this is
// the ROOT layout and types `children` accordingly. It's auto-generated,
// not something we wrote ourselves (see `npx next typegen`).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
