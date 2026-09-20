"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
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
  { href: "/dashboard/invoices", label: "Invoices" },
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
      <div className="flex min-h-screen flex-1">
        <aside className="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
          <p className="px-2 text-lg font-semibold text-emerald-700">MellaX</p>
          <nav className="mt-6 space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-2 py-1.5 text-sm ${
                    active ? "bg-emerald-50 font-medium text-emerald-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
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
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </Protected>
  );
}
