"use client";
// "use client" tells Next.js this file runs in the BROWSER, not on the
// server. It needs to, because it uses React hooks (useState, useEffect)
// and reads localStorage — neither of those exist on a server.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiFetch, setToken } from "./api";

// ----------------------------------------------------------------------------
// This file sets up "who is currently logged in" as global state that any
// component in the app can read, using React's Context API. Without this,
// we'd have to pass the logged-in account down as a prop through every
// single layer of components — Context lets any component just ask for
// it directly with the `useAuth()` hook at the bottom of this file.
// ----------------------------------------------------------------------------

// The shape of an account, matching what the backend's
// BusinessAccountSerializer sends back (see accounts/serializers.py).
export type Account = {
  id: number;
  email: string;
  business_name: string;
  plan_tier: "basic" | "plus" | "premium";
  // Business Information
  phone: string;
  address: string;
  // Branding — `logo` is a full URL once uploaded (e.g.
  // "http://127.0.0.1:8001/media/logos/xyz.png"), or null until then.
  logo: string | null;
  accent_color: string;
  // Invoice Settings
  service_tax_percent: string; // Django's DecimalField serializes as a string, e.g. "8.50" — keeps the exact value instead of floating-point rounding
  product_tax_percent: string;
  invoice_prefix: string;
  default_invoice_terms: string;
  time_zone: string;
  is_email_verified: boolean;
  created_at: string;
};

// What useAuth() actually gives you — the current account, whether we're
// still figuring that out, and functions to log in/out.
type AuthContextValue = {
  account: Account | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Account>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
};

// React Context always needs a "default" value — null here, but nothing
// should ever actually see this null, because AuthProvider always
// provides a real value. (If something DOES see null, useAuth() below
// throws an error, which usually means AuthProvider is missing from the
// component tree somewhere.)
const AuthContext = createContext<AuthContextValue | null>(null);

// This wraps the ENTIRE app (see it being used in app/layout.tsx) so
// every page has access to the logged-in account.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true); // true until we've checked whether a saved token is still valid

  // useCallback just means "don't recreate this function on every
  // re-render" — mostly matters because it's used inside a useEffect
  // dependency array below, and we don't want that effect re-running
  // constantly for no reason.
  const refreshAccount = useCallback(async () => {
    try {
      // If there's a token saved in localStorage from a previous visit,
      // this asks the backend "who does this token belong to, and is it
      // still valid?"
      const me = await apiFetch<Account>("/api/accounts/me/");
      setAccount(me);
    } catch {
      // Token missing, expired, or invalid — just treat it as "not logged in."
      setAccount(null);
      setToken(null);
    }
  }, []);

  // Runs once when the app first loads, to check "is there already a
  // logged-in session from before?" (e.g. the user refreshed the page).
  useEffect(() => {
    // Async fetch-on-mount resolving a loading flag, not a synchronous
    // setState during the effect body — safe despite the lint rule's
    // static analysis flagging it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAccount().finally(() => setLoading(false));
  }, [refreshAccount]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<{ token: string; account: Account }>(
      "/api/accounts/login/",
      { method: "POST", body: { email, password }, auth: false } // auth: false because we don't have a token yet — that's the whole point of this call
    );
    setToken(result.token); // save it for next time (and for every apiFetch call from now on)
    setAccount(result.account);
    return result.account;
  }, []);

  const logout = useCallback(() => {
    // Tell the backend to invalidate the token too (not just forget it on
    // our end) — .catch(() => {}) because even if this fails (e.g. we're
    // offline), we still want to log the user out locally.
    apiFetch("/api/accounts/logout/", { method: "POST" }).catch(() => {});
    setToken(null);
    setAccount(null);
  }, []);

  return (
    <AuthContext.Provider value={{ account, loading, login, logout, refreshAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

// The hook every page/component actually uses:
//   const { account, login, logout } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
