"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { LowStockAlert } from "@/components/LowStockAlert";
import { Protected } from "@/components/protected";

// ----------------------------------------------------------------------------
// This layout.tsx wraps EVERY page under /dashboard/* (clients, services,
// invoices, reports, etc) — the sidebar nav, top header, and the login
// check only need to be written once here instead of copy-pasted into
// every single dashboard page.
// ----------------------------------------------------------------------------

// The sidebar links — adding a new dashboard section later is just
// adding one line here.
const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/marketing", label: "Marketing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const pathname = usePathname(); // the current URL path, e.g. "/dashboard/clients" — used to highlight the active nav link
  const router = useRouter();
  const { account, logout } = useAuth();

  return (
    <Protected>
      {/* Everything inside <Protected> only renders once we know someone's logged in */}
      {/* Background comes from the Settings > Theme preset (see
          themePresets.ts) - painted ONCE here, on the outer shell, rather
          than separately on the sidebar/header/main. Per Mako: the
          sidebar and the page background should be the same thing, not
          two coordinated-but-different colors - a plain hairline border
          is what actually separates "nav" from "content" now, the way
          Linear/Notion/Stripe do it, instead of a solid color block.
          That also means a Design preset's illustration spans the FULL
          width of the screen in one continuous strip instead of getting
          cropped into two differently-scaled copies.
          Inline style (not a Tailwind class) since a preset can be a
          gradient/image and Tailwind's bg-[...] can't reliably tell that
          apart from a plain color. The print stylesheet (globals.css)
          forces this back to plain white so a themed background never
          bleeds into a printed invoice. */}
      <div
        className="theme-bg flex min-h-screen flex-1"
        style={{ background: "var(--app-bg, #f9fafb)", backgroundAttachment: "fixed" }}
      >
        {/* print:hidden on the sidebar and header below: pages like the
            printable invoice (dashboard/invoices/[id]/print) live under
            this same layout for convenience, but the browser's actual
            print output should show just the invoice, not the app chrome
            around it — the on-screen view is unaffected either way. */}
        <aside className="w-56 shrink-0 border-r border-gray-200 p-4 print:hidden">
          <div className="flex items-center gap-2 px-2">
            {/* The business's own logo, once uploaded (Settings >
                Branding) — seeing their own branding while using the
                software, not just "MellaX", is the point here. Falls
                back to just the wordmark until they add one. */}
            {account?.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.logo} alt="" className="h-6 w-6 rounded object-cover" />
            )}
            <p className="text-lg font-semibold text-[var(--accent-700,#047857)]">MellaX</p>
          </div>
          <nav className="mt-6 space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md border-l-2 px-2 py-1.5 text-sm ${
                    active
                      ? "border-[var(--accent-600,#059669)] bg-black/5 font-medium text-[var(--accent-700,#047857)]"
                      : "border-transparent text-gray-600 hover:bg-black/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {/* A Design preset's illustration (Settings > Theme >
              Background), pinned to the bottom of the sidebar specifically
              — not the whole window. Per Mako: on a content-heavy page
              like Overview, the version painted behind the main content
              area (see --app-bg above) can end up scrolled out of view
              entirely behind a tall calendar/card stack. The sidebar
              always has open space below its nav links though, on every
              single page, so anchoring a second copy of the art there
              (position: fixed, so it stays put regardless of how tall
              the page's content gets) is what actually guarantees it's
              visible. pointer-events-none so it never intercepts clicks
              on whatever nav link happens to sit near the bottom. */}
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 h-44 w-56"
            style={{
              backgroundImage: "var(--app-art, none)",
              backgroundPosition: "bottom",
              backgroundSize: "100% 176px",
              backgroundRepeat: "no-repeat",
            }}
          />
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 print:hidden">
            <span className="text-sm text-gray-500">{account?.business_name}</span>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Log out
            </button>
          </header>
          {/* {children} is where the actual page content (Clients,
              Invoices, etc) gets slotted in — this is the "layout wraps
              page" pattern that's core to how Next.js's App Router works. */}
          <main className="flex-1 p-6 print:p-0">{children}</main>
        </div>
      </div>
      {/* Checked once per dashboard load, regardless of which page —
          low stock is a business-wide concern, not a Products-page-only one. */}
      <LowStockAlert />
    </Protected>
  );
}
