"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/form";

type ProfitLoss = { revenue: number; refunds: number; net: number; tax_collected: number };

export default function DashboardOverviewPage() {
  const { account } = useAuth();
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [pnl, setPnl] = useState<ProfitLoss | null>(null);

  useEffect(() => {
    apiFetch<unknown[]>("/api/clients/").then((clients) => setClientCount(clients.length));
    apiFetch<ProfitLoss>("/api/reports/profit-loss/").then(setPnl);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        Welcome back, {account?.business_name}
      </h1>

      {clientCount === 0 ? (
        <Card className="p-6 text-sm text-gray-600">
          You don&apos;t have any clients yet —{" "}
          <Link href="/dashboard/clients" className="text-emerald-700 underline">
            add your first one
          </Link>
          .
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-xs uppercase text-gray-500">Clients</p>
            <p className="mt-1 text-2xl font-semibold">{clientCount ?? "…"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-gray-500">Revenue (YTD)</p>
            <p className="mt-1 text-2xl font-semibold">
              ${pnl ? pnl.revenue.toFixed(2) : "…"}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-gray-500">Net (YTD)</p>
            <p className="mt-1 text-2xl font-semibold">${pnl ? pnl.net.toFixed(2) : "…"}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
