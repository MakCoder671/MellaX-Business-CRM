"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { changeText, money, percent, type GrowthReport, type MonthRow } from "@/lib/reports";
import { Card, ErrorText } from "@/components/form";
import { ReportHelp } from "./ReportHelp";
import { presetRanges, RangePicker, type DateRange } from "./RangePicker";

// The growth dashboard. Shows how the business is doing for the chosen dates,
// next to the same dates last year, and where the next gains are likely to come from.
export function GrowthDashboard() {
  const [range, setRange] = useState<DateRange>(() => presetRanges()[0]);
  // Each result is tagged with the range it was loaded for, so an old result is never shown for new dates.
  const [result, setResult] = useState<{ key: string; report: GrowthReport } | null>(null);
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = `${range.start}|${range.end}`;
  const report = result?.key === key ? result.report : null;

  useEffect(() => {
    apiFetch<{ months: MonthRow[] }>("/api/reports/monthly/?months=12")
      .then((data) => setMonths(data.months))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the monthly chart."));
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<GrowthReport>(`/api/reports/growth/?start=${range.start}&end=${range.end}`)
      .then((data) => {
        if (!cancelled) setResult({ key, report: data });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the growth report.");
      });
    return () => {
      cancelled = true;
    };
  }, [key, range.start, range.end]);

  const current = report?.current;
  const bookings = report?.bookings;

  return (
    <div className="space-y-6">
      <ReportHelp
        shows={[
          "How much you earned from sales in the dates you pick, next to the same dates last year.",
          "The average sale, how many paid invoices you had, and how many clients came in.",
          "How many clients came back, which clients you haven't seen in a while, and which days and hours are busiest.",
        ]}
        howToRead={[
          "Green arrows mean you're up on last year. Red arrows mean you're down.",
          "Average sale is what one paid invoice brings in, on average. Raising it is often the quickest way to earn more.",
          "A high returning rate means clients like the service enough to come back.",
        ]}
        leavesOut={[
          "Sales tax. Tax you collect belongs to the state, so it isn't counted as earnings here.",
          "Unpaid invoices and quotes, until they are paid.",
          "Anything outside MellaX, like cash you never recorded.",
        ]}
      />

      <Card className="p-4">
        <RangePicker value={range} onChange={setRange} />
      </Card>

      <ErrorText>{error}</ErrorText>
      {!report && !error && <p className="text-sm text-gray-500">Loading your numbers…</p>}

      {report && current && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Sales, before sales tax"
              value={money(current.net_revenue)}
              change={report.changes.net_revenue}
              hint="Money from paid sales, minus refunds. Sales tax is left out."
            />
            <Kpi
              label="Average sale"
              value={money(current.average_ticket)}
              change={report.changes.average_ticket}
              hint="What one paid invoice brings in, on average."
            />
            <Kpi
              label="Paid invoices"
              value={String(current.paid_invoices)}
              change={report.changes.paid_invoices}
              hint="How many invoices were paid or partly refunded in these dates."
            />
            <Kpi
              label="Profit after expenses"
              value={money(current.profit)}
              change={report.changes.profit}
              hint="Sales, minus what the goods cost, minus your expenses."
            />
          </section>

          {current.products_without_cost > 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {current.products_without_cost} product {current.products_without_cost === 1 ? "sale has" : "sales have"} no cost set,
              so profit may look higher than it is. Add a cost to each product on the Products page.
            </p>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Clients served"
              value={String(current.clients_served)}
              change={report.changes.clients_served}
              hint={`${current.new_clients} were new clients in these dates.`}
            />
            <Kpi
              label="Returning clients"
              value={percent(current.returning_rate)}
              hint={`${current.returning_clients} of ${current.clients_served} came back after an earlier visit.`}
            />
            <Kpi
              label="Cancelled bookings"
              value={percent(bookings?.cancelled_rate)}
              hint={`${bookings?.cancelled ?? 0} of ${bookings?.bookings ?? 0} bookings were cancelled.`}
            />
            <Kpi
              label="No-shows"
              value={percent(bookings?.no_show_rate)}
              hint={`${bookings?.no_shows ?? 0} clients didn't show up for their booking.`}
            />
          </section>

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Last 12 months</h2>
                <p className="text-sm text-gray-500">Sales compared with profit, month by month. The current month is still in progress.</p>
              </div>
            </div>
            {months ? <MonthlyChart months={months} /> : <p className="text-sm text-gray-500">Loading chart…</p>}
          </Card>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-3 p-5">
              <h2 className="text-base font-semibold text-gray-900">Busiest days</h2>
              <p className="text-sm text-gray-500">Bookings per weekday in these dates. Cancelled bookings aren&apos;t counted.</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.busiest.by_weekday}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(0, 3)} fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#10b981" radius={[4, 4, 0, 0]} name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {report.busiest.by_hour.length > 0 && (
                <p className="text-sm text-gray-600">
                  Busiest hour:{" "}
                  <span className="font-semibold text-gray-900">
                    {formatHour(
                      report.busiest.by_hour.reduce((best, row) => (row.bookings > best.bookings ? row : best)).hour,
                    )}
                  </span>
                </p>
              )}
            </Card>

            <Card className="space-y-3 p-5">
              <h2 className="text-base font-semibold text-gray-900">Top services</h2>
              <p className="text-sm text-gray-500">Which services brought in the most sales in these dates.</p>
              {report.top_services.length === 0 ? (
                <p className="text-sm text-gray-500">No paid services in these dates yet.</p>
              ) : (
                <ul className="space-y-3">
                  {report.top_services.map((service) => (
                    <li key={service.name}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">{service.name}</span>
                        <span className="text-gray-700">
                          {money(service.revenue)} <span className="text-gray-400">({percent(service.share)})</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, service.share)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Clients to call back</h2>
              <p className="text-sm text-gray-500">
                {report.lapsed.over_60_days} clients haven&apos;t been in for 60 days or more, and {report.lapsed.over_90_days} for
                90 days or more. A short message or a rebooking reminder often brings them back.
              </p>
            </div>
            {report.lapsed.list.length === 0 ? (
              <p className="text-sm text-gray-500">Everyone has been in recently. Nice work.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-2 pr-4">Client</th>
                      <th className="py-2 pr-4">Last visit</th>
                      <th className="py-2 pr-4">Days since</th>
                      <th className="py-2 pr-4">Total visits</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.lapsed.list.map((row) => (
                      <tr key={row.client_id}>
                        <td className="py-2 pr-4 font-medium text-gray-900">{row.name}</td>
                        <td className="py-2 pr-4 text-gray-700">{row.last_visit}</td>
                        <td className="py-2 pr-4 text-gray-700">{row.days_since}</td>
                        <td className="py-2 pr-4 text-gray-700">{row.visits}</td>
                        <td className="py-2 text-right">
                          <Link href={`/dashboard/clients/${row.client_id}`} className="text-sm font-medium underline">
                            Open client
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, change, hint }: { label: string; value: string; change?: number | null; hint: string }) {
  const hasChange = change !== undefined && change !== null;
  const up = hasChange && (change as number) > 0;
  const down = hasChange && (change as number) < 0;
  return (
    <Card className="space-y-2 p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      {change !== undefined && (
        <p
          className={`flex items-center gap-1 text-sm font-medium ${
            up ? "text-emerald-700" : down ? "text-rose-700" : "text-gray-500"
          }`}
        >
          {up ? <ArrowUpRight className="h-4 w-4" /> : down ? <ArrowDownRight className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          {changeText(change)}
        </p>
      )}
      <p className="text-xs leading-relaxed text-gray-500">{hint}</p>
    </Card>
  );
}

function MonthlyChart({ months }: { months: MonthRow[] }) {
  const data = months.map((m) => ({
    month: m.label,
    Sales: Number(m.net_revenue),
    Profit: Number(m.profit),
  }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" fontSize={11} />
          <YAxis fontSize={12} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip formatter={(value) => money(Number(value))} />
          <Legend />
          <Bar dataKey="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Profit" fill="#64748b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatHour(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${period}`;
}
