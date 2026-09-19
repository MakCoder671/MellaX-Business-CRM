"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiFetch, setToken } from "./api";

export type Account = {
  id: number;
  email: string;
  business_name: string;
  plan_tier: "basic" | "plus" | "premium";
  phone: string;
  address: string;
  is_email_verified: boolean;
  created_at: string;
};

type AuthContextValue = {
  account: Account | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Account>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccount = useCallback(async () => {
    try {
      const me = await apiFetch<Account>("/api/accounts/me/");
      setAccount(me);
    } catch {
      setAccount(null);
      setToken(null);
    }
  }, []);

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
      { method: "POST", body: { email, password }, auth: false }
    );
    setToken(result.token);
    setAccount(result.account);
    return result.account;
  }, []);

  const logout = useCallback(() => {
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
