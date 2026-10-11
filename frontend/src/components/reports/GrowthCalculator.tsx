"use client";

import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { isoDay, money, percent, type GrowthReport, type MonthRow } from "@/lib/reports";
import { Button, Card, ErrorText } from "@/components/form";
import { ReportHelp } from "./ReportHelp";

// The growth calculator. Starts from the last twelve complete months of real
// numbers, then lets the owner test changes: more visits, higher prices, more
// clients coming back, fewer no-shows, and different expenses. Nothing is saved.

type Levers = {
  visitsChange: number; // % change in paid visits (invoices) per month
  saleChange: number; // % change in the average sale (price rises or add-ons)
  winBack: number; // extra clients a month won back from the lapsed list
  noShowCut: number; // % of missed bookings you recover (fewer cancellations and no-shows)
  expenseChange: number; // % change in monthly expenses
};

const NO_CHANGE: Levers = { visitsChange: 0, saleChange: 0, winBack: 0, noShowCut: 0, expenseChange: 0 };

type Baseline = {
  months: number;
  visits: number; // average paid invoices per month
  sale: number; // average sale
  cogsPerVisit: number;
  sales: number; // average sales per month
  cogs: number;
  expenses: number;
  profit: number;
  bookingsPerMonth: number;
  missedRate: number; // share of bookings that were cancelled or missed, as a fraction
  productsWithoutCost: number; // product sales in the period that have no cost set
};

function buildBaseline(months: MonthRow[], growth: GrowthReport): Baseline | null {
  // The newest month is usually still in progress, so take the last twelve complete months.
  const complete = months.filter((m) => !m.is_partial).slice(-12);
  if (complete.length === 0) return null;
  const n = complete.length;
  const sum = (pick: (m: MonthRow) => number) => complete.reduce((total, m) => total + Number(pick(m)), 0);

  const totalSales = sum((m) => m.net_revenue);
  const totalVisits = sum((m) => m.paid_invoices);
  // Twelve empty months aren't a history to learn from, so the calculator waits for real sales.
  if (totalVisits === 0) return null;
  const totalCogs = sum((m) => m.cost_of_goods);
  const totalExpenses = sum((m) => m.expenses);

  return {
    months: n,
    visits: totalVisits / n,
    sale: totalVisits > 0 ? totalSales / totalVisits : 0,
    cogsPerVisit: totalVisits > 0 ? totalCogs / totalVisits : 0,
    sales: totalSales / n,
    cogs: totalCogs / n,
    expenses: totalExpenses / n,
    profit: sum((m) => m.profit) / n,
    bookingsPerMonth: growth.bookings.bookings / 12,
    missedRate: (growth.bookings.cancelled_rate + growth.bookings.no_show_rate) / 100,
    productsWithoutCost: complete.reduce((total, m) => total + Number(m.products_without_cost ?? 0), 0),
  };
}

function project(base: Baseline, levers: Levers) {
  const recovered = base.bookingsPerMonth * base.missedRate * (levers.noShowCut / 100);
  const visits = base.visits * (1 + levers.visitsChange / 100) + levers.winBack + recovered;
  const sale = base.sale * (1 + levers.saleChange / 100);
  const sales = visits * sale;
  const cogs = visits * base.cogsPerVisit;
  const expenses = base.expenses * (1 + levers.expenseChange / 100);
  return { visits, sale, sales, cogs, expenses, profit: sales - cogs - expenses, recovered };
}

// Quick starting points. Each one sets the sliders to a common idea, so owners can see its effect in one click.
function scenarios(base: Baseline | null): { label: string; levers: Levers }[] {
  const addOnSale = base && base.sale > 0 ? (10 / base.sale) * 100 : 0;
  return [
    { label: "Raise prices 10%", levers: { ...NO_CHANGE, saleChange: 10 } },
    { label: "Win back 5 lapsed clients a month", levers: { ...NO_CHANGE, winBack: 5 } },
    { label: "Halve cancellations and no-shows", levers: { ...NO_CHANGE, noShowCut: 50 } },
    { label: "Add a $10 product to each visit", levers: { ...NO_CHANGE, saleChange: Math.round(addOnSale * 10) / 10 } },
    { label: "Get 10% more visits", levers: { ...NO_CHANGE, visitsChange: 10 } },
  ];
}

export function GrowthCalculator() {
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [growth, setGrowth] = useState<GrowthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levers, setLevers] = useState<Levers>(NO_CHANGE);

  useEffect(() => {
    apiFetch<{ months: MonthRow[] }>("/api/reports/monthly/?months=13")
      .then((data) => setMonths(data.months))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your history."));
  }, []);

  useEffect(() => {
    // The last 12 months of bookings, for how often visits are missed.
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);
    apiFetch<GrowthReport>(`/api/reports/growth/?start=${isoDay(yearAgo)}&end=${isoDay(today)}`)
      .then(setGrowth)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your bookings."));
  }, []);

  const base = months && growth ? buildBaseline(months, growth) : null;

  function set<K extends keyof Levers>(key: K, value: number) {
    setLevers((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <ReportHelp
        shows={[
          "What your numbers look like on an average month, based on your last 12 complete months.",
          "What would change if you raised prices, sold more per visit, brought clients back, or cut missed bookings.",
          "The difference per month and per year, so you can see which change is worth the effort.",
        ]}
        howToRead={[
          "Move a slider or type a number. The table updates straight away.",
          "Start from a quick scenario, then adjust it. Try one change at a time to see its effect on its own.",
          "Profit is what you keep after the cost of goods and your expenses. That's the number to focus on.",
        ]}
        leavesOut={[
          "This is an estimate, not a forecast. It assumes the rest of your business stays the same.",
          "Nothing here is saved or sent anywhere. Change the numbers as often as you like.",
          "Sales tax. Your cost of goods is worked out from what you've recorded on past sales, so new costs only show up once they're on your invoices.",
        ]}
      />

      <ErrorText>{error}</ErrorText>
      {!base && !error && <p className="text-sm text-gray-500">Loading your history…</p>}

      {base === null && months && growth && (
        <Card className="p-6 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Not enough history yet</p>
          <p className="mt-2">
            The calculator needs at least one complete month of sales to work from. Come back after your first full month
            of paid invoices.
          </p>
        </Card>
      )}

      {base && (
        <>
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Quick scenarios</h2>
                <p className="text-sm text-gray-500">Pick one to start, then adjust it below.</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setLevers(NO_CHANGE)} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Reset to today
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {scenarios(base).map((scenario) => (
                <button
                  key={scenario.label}
                  type="button"
                  onClick={() => setLevers(scenario.levers)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </Card>

          <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <Card className="space-y-6 p-5">
              <h2 className="text-base font-semibold text-gray-900">Your changes</h2>
              <Lever
                label="More or fewer paid visits"
                help="Percent more (or fewer) invoices paid each month, from better marketing, more hours, or more repeat visits."
                value={levers.visitsChange}
                min={-50}
                max={100}
                suffix="%"
                onChange={(v) => set("visitsChange", v)}
              />
              <Lever
                label="Average sale"
                help="Percent change in what each visit brings in. A price rise or selling an add-on both do this."
                value={levers.saleChange}
                min={-20}
                max={100}
                suffix="%"
                onChange={(v) => set("saleChange", v)}
              />
              <Lever
                label="Clients won back each month"
                help={lapsedHelp(growth?.lapsed.over_60_days ?? 0)}
                value={levers.winBack}
                min={0}
                max={30}
                suffix="clients"
                onChange={(v) => set("winBack", v)}
              />
              <Lever
                label="Missed bookings recovered"
                help={`About ${percent(base.missedRate * 100)} of your bookings are cancelled or missed. This is the share of those you'd keep by reminding clients.`}
                value={levers.noShowCut}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => set("noShowCut", v)}
              />
              <Lever
                label="Change in monthly expenses"
                help="Percent more (or less) you spend each month, like a new tool or cutting a subscription."
                value={levers.expenseChange}
                min={-50}
                max={100}
                suffix="%"
                onChange={(v) => set("expenseChange", v)}
              />
            </Card>

            <Card className="space-y-4 p-5">
              <h2 className="text-base font-semibold text-gray-900">What it means</h2>
              {base.productsWithoutCost > 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                {base.productsWithoutCost} product {base.productsWithoutCost === 1 ? "sale has" : "sales have"} no cost set. Those
                sales count as $0 cost, so profit may look higher than it is. Add a cost to each product on the Products page.
              </p>
            )}
            <ComparisonTable base={base} levers={levers} />
              <Verdict base={base} levers={levers} />
            </Card>
          </section>

          <Card className="space-y-2 p-5 text-sm text-gray-700">
            <h2 className="text-base font-semibold text-gray-900">How the numbers are worked out</h2>
            <p>
              Your starting point is the average of your last {base.months} complete months. Paid visits, average sale, cost
              of goods, and expenses each come from that history.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Visits = your average visits × (1 + visit change) + clients won back + missed bookings recovered.</li>
              <li>Average sale = your average sale × (1 + sale change).</li>
              <li>Sales = visits × average sale. Cost of goods = visits × your cost per visit.</li>
              <li>Expenses = your average expenses × (1 + expense change).</li>
              <li>Profit = sales − cost of goods − expenses.</li>
              <li>Yearly figures are the monthly figures × 12.</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Lever({
  label,
  help,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs leading-relaxed text-gray-500">{help}</p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-sm">
          <input
            type="number"
            aria-label={label}
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
          />
          <span className="text-gray-500">{suffix}</span>
        </label>
      </div>
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
    </div>
  );
}

function lapsedHelp(count: number) {
  const noun = count === 1 ? "client" : "clients";
  const verb = count === 1 ? "hasn't" : "haven't";
  return `You have ${count} ${noun} who ${verb} been in for 60 days. Each one you bring back adds a visit a month.`;
}

function ComparisonTable({ base, levers }: { base: Baseline; levers: Levers }) {
  const scenario = project(base, levers);
  const rows = [
    { label: "Paid visits a month", today: base.visits, changed: scenario.visits, format: (n: number) => n.toFixed(1) },
    { label: "Average sale", today: base.sale, changed: scenario.sale, format: money },
    { label: "Sales a month", today: base.sales, changed: scenario.sales, format: money },
    { label: "Cost of goods a month", today: base.cogs, changed: scenario.cogs, format: money },
    { label: "Expenses a month", today: base.expenses, changed: scenario.expenses, format: money },
    { label: "Profit a month", today: base.profit, changed: scenario.profit, format: money, strong: true },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="py-2 pr-3" />
            <th className="py-2 pr-3 text-right">Today</th>
            <th className="py-2 pr-3 text-right">With changes</th>
            <th className="py-2 text-right">Difference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const diff = row.changed - row.today;
            return (
              <tr key={row.label} className={row.strong ? "font-semibold text-gray-900" : "text-gray-700"}>
                <td className="py-2 pr-3">{row.label}</td>
                <td className="py-2 pr-3 text-right">{row.format(row.today)}</td>
                <td className="py-2 pr-3 text-right">{row.format(row.changed)}</td>
                <td className={`py-2 text-right ${diff > 0.005 ? "text-emerald-700" : diff < -0.005 ? "text-rose-700" : ""}`}>
                  {diff > 0 ? "+" : ""}
                  {row.format(diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Verdict({ base, levers }: { base: Baseline; levers: Levers }) {
  const scenario = project(base, levers);
  const yearly = (scenario.profit - base.profit) * 12;
  const tone = yearly > 0.5 ? "emerald" : yearly < -0.5 ? "rose" : "gray";
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
  } as const;
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${styles[tone]}`}>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {Math.abs(yearly) < 0.5
          ? "These changes wouldn't change your yearly profit. Try a different change."
          : yearly > 0
            ? `With these changes you could keep about ${money(yearly)} more profit each year.`
            : `With these changes you'd keep about ${money(-yearly)} less profit each year.`}
      </p>
    </div>
  );
}
