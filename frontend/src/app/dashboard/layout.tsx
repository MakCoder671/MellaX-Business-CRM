"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Settings as SettingsIcon,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

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
// adding one line here. Icons are purely decorative labeling (lucide
// inherits the link's text color via `currentColor`, so the active/hover
// states below still only need to be set once, on the <Link> itself).
const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/services", label: "Services", icon: Wrench },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const pathname = usePathname(); // the current URL path, e.g. "/dashboard/clients" — used to highlight the active nav link
  const router = useRouter();
  const { account, logout } = useAuth();

  // Below `lg` (1024px — covers phones AND iPads, since iPad landscape
  // is exactly 1024px), the sidebar becomes an off-canvas drawer instead
  // of always-visible — there just isn't room for a permanent 256px nav
  // column on a screen that size. At `lg` and up this state is never
  // read (the drawer classes below are all overridden back to the
  // original static layout via lg: variants), so desktop behavior is
  // completely unchanged.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Which nav item the CURRENT page belongs to — checked in array order
  // but skipping Overview's exact-match check until last, since
  // "/dashboard" is a prefix of every other href too (a naive
  // pathname.startsWith(item.href) would make every single dashboard
  // page match Overview first).
  const activeNav =
    NAV.find((item) => item.href !== "/dashboard" && pathname.startsWith(item.href)) ??
    (pathname === "/dashboard" ? NAV[0] : undefined);

  const initial = account?.business_name?.trim()?.[0]?.toUpperCase() ?? "?";

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
        {/* Backdrop — only ever rendered while the drawer is open, and
            `lg:hidden` means it's never shown at desktop widths even if
            sidebarOpen were somehow true there. Tapping it closes the
            drawer, same as tapping a nav link does. */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        {/* print:hidden on the sidebar and header below: pages like the
            printable invoice (dashboard/invoices/[id]/print) live under
            this same layout for convenience, but the browser's actual
            print output should show just the invoice, not the app chrome
            around it — the on-screen view is unaffected either way.

            Below `lg`: an off-canvas drawer (fixed, slides in/out via
            translate-x, closed by default). At `lg` and up: `lg:static
            lg:translate-none` puts it back to exactly today's always-
            visible layout. `translate-none` specifically, not just
            leaving translate-x-0 — Tailwind v4's translate-x-* utilities
            set the standalone CSS `translate` property (not `transform`),
            and ANY non-"none" value there (even "0px", which is what
            translate-x-0 computes to) still turns this element into the
            containing block for the fixed-position design-art div nested
            inside it below, which needs to stay positioned relative to
            the actual viewport at desktop widths for the "art visible
            even on a tall Overview page" fix to keep working. Confirmed
            with getComputedStyle in a real browser, not just reasoned
            about — translate-x-0 alone left the sidebar rendered 256px
            off-screen at desktop widths even though `transform` itself
            correctly read "none". */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-gray-200/80 p-3 transition-transform duration-200 print:hidden lg:static lg:translate-none ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "var(--app-bg, #f9fafb)" }}
        >
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="absolute right-2 top-2 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
          {/* Workspace header — the business's OWN identity is the
              primary brand here, not the "MellaX" product name. A
              bigger logo badge + the actual business_name, styled like
              a workspace switcher (Linear/Notion/Vercel), links through
              to Branding so "make this look like us" has an obvious
              home. The product name moves to a small footer tag further
              down instead of competing for this spot. */}
          <Link
            href="/dashboard/settings"
            onClick={() => setSidebarOpen(false)}
            className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-gray-200/80 hover:bg-white"
          >
            {account?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.logo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm" />
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold accent-bg shadow-sm"
                aria-hidden="true"
              >
                {initial === "?" ? <Building2 className="h-5 w-5" /> : initial}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight text-gray-900">
                {account?.business_name || "Your business"}
              </span>
              <span className="block text-xs text-gray-400">Workspace settings</span>
            </span>
          </Link>

          <div className="mx-2 my-3 border-t border-gray-200/80" />

          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = item.href === activeNav?.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent-50,#ecfdf5)] font-medium text-[var(--accent-700,#047857)]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                      active ? "accent-bg" : "text-gray-400 group-hover:text-gray-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
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
            className="pointer-events-none fixed inset-x-0 bottom-0 h-44 w-60"
            style={{
              backgroundImage: "var(--app-art, none)",
              backgroundPosition: "bottom",
              backgroundSize: "100% 176px",
              backgroundRepeat: "no-repeat",
            }}
          />
          {/* Footer — pinned above the design art (relative + z-10, so
              it always paints on top of that fixed layer instead of the
              art bleeding through underneath its text). Business
              identity already lives in the header above, so this row is
              just sign-out plus a small, deliberately quiet "MellaX"
              product tag — the platform is still credited, but it no
              longer competes with the tenant's own brand for the most
              prominent spot in their own workspace. */}
          <div className="relative z-10 mt-auto flex items-center justify-between gap-2 px-1 pt-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
              MellaX
            </span>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              Log out
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-gray-200/80 px-4 py-3.5 sm:px-6 print:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="-ml-1 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
            <h1 className="text-base font-semibold text-gray-900">{activeNav?.label ?? "Dashboard"}</h1>
          </header>
          {/* {children} is where the actual page content (Clients,
              Invoices, etc) gets slotted in — this is the "layout wraps
              page" pattern that's core to how Next.js's App Router works. */}
          <main className="flex-1 p-4 sm:p-6 print:p-0">{children}</main>
        </div>
      </div>
      {/* Checked once per dashboard load, regardless of which page —
          low stock is a business-wide concern, not a Products-page-only one. */}
      <LowStockAlert />
    </Protected>
  );
}
