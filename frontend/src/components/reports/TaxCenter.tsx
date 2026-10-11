"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { downloadFile, money, type TaxQuarters, type TaxYear } from "@/lib/reports";
import { Button, Card, ErrorText } from "@/components/form";
import { ReportHelp } from "./ReportHelp";
import { OtherIncomeCard, ReadinessCard, type ReadinessCheck } from "./TaxExtras";
import { presetRanges, RangePicker, type DateRange } from "./RangePicker";

// The tax center. Everything an accountant asks for in one place: the
// Schedule C summary (the federal form, the same in every state), sales and
// sales tax by quarter, and CSV files for the books.

const US_LOCATIONS: { code: string; name: string; territory?: boolean }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "PR", name: "Puerto Rico", territory: true }, { code: "GU", name: "Guam", territory: true },
  { code: "VI", name: "U.S. Virgin Islands", territory: true }, { code: "AS", name: "American Samoa", territory: true },
  { code: "MP", name: "Northern Mariana Islands", territory: true },
];

const FILING_OPTIONS = ["Monthly", "Quarterly", "Annually", "Not sure yet"];

// Matches whatever the owner typed for their state on the business address, by name or by code.
function locationFromAddress(state: string | undefined) {
  if (!state) return "";
  const wanted = state.trim().toLowerCase();
  const match = US_LOCATIONS.find((l) => l.name.toLowerCase() === wanted || l.code.toLowerCase() === wanted);
  return match ? match.code : "";
}

export function TaxCenter() {
  const { account } = useAuth();
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3];
  const [year, setYear] = useState(thisYear);
  const [location, setLocation] = useState("");
  const [filing, setFiling] = useState("Not sure yet");
  const [range, setRange] = useState<DateRange>(() => presetRanges()[0]);
  const [taxYear, setTaxYear] = useState<{ key: number; data: TaxYear } | null>(null);
  const [quarters, setQuarters] = useState<{ key: number; data: TaxQuarters } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [locationTouched, setLocationTouched] = useState(false);
  const [checks, setChecks] = useState<ReadinessCheck[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Start from the state on the business address, until the owner picks one themselves.
  const effectiveLocation = locationTouched ? location : locationFromAddress(account?.state);
  const chosen = US_LOCATIONS.find((l) => l.code === effectiveLocation);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<TaxYear>(`/api/reports/tax/year/?year=${year}`),
      apiFetch<TaxQuarters>(`/api/reports/tax/quarters/?year=${year}`),
      apiFetch<{ readiness: ReadinessCheck[] }>(`/api/reports/tax/packet/?year=${year}`),
    ])
      .then(([yearData, quarterData, packet]) => {
        if (cancelled) return;
        setTaxYear({ key: year, data: yearData });
        setQuarters({ key: year, data: quarterData });
        setChecks(packet.readiness);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load your tax summary.");
      });
    return () => {
      cancelled = true;
    };
  }, [year, reloadKey]);

  const summary = taxYear?.key === year ? taxYear.data : null;
  const quarterly = quarters?.key === year ? quarters.data : null;

  async function download(path: string, filename: string, label: string) {
    setDownloading(label);
    setError(null);
    try {
      await downloadFile(path, filename);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't make that file. Try again.");
    } finally {
      setDownloading(null);
    }
  }

  const rangeQuery = `start=${range.start}&end=${range.end}`;

  return (
    <div className="space-y-6">
      <ReportHelp
        shows={[
          "A summary of your year laid out line by line, the same order as the federal Schedule C form that sole proprietors file.",
          "Sales, taxable sales, and sales tax collected for each quarter, for your state's sales tax or gross receipts return.",
          "CSV files of your payments, invoices, expenses, and clients, for your accountant or your own records.",
        ]}
        howToRead={[
          "Check the year first. Each figure is for that calendar year only.",
          "Your accountant can check each Schedule C line against this summary. The line numbers match the form.",
          "The quarterly table gives the figures your state asks for. Each state sets its own rules, so use the link to find your state's form.",
        ]}
        leavesOut={[
          "Tax advice. MellaX shows the numbers, but your accountant or state decides how to file them.",
          "Income from outside MellaX, home office costs, and any other income. Add those with your accountant.",
          "Anything that depends on rules for your state. Your state's revenue department sets those.",
        ]}
      />

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <label className="block text-sm font-medium text-gray-700">
          Tax year
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Your state or territory
          <select
            value={effectiveLocation}
            onChange={(e) => {
              setLocationTouched(true);
              setLocation(e.target.value);
            }}
            className="mt-1 block min-w-56 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Choose one</option>
            {US_LOCATIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          How often you file sales tax
          <select
            value={filing}
            onChange={(e) => setFiling(e.target.value)}
            className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {FILING_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </Card>

      <ErrorText>{error}</ErrorText>
      {!summary && !error && <p className="text-sm text-gray-500">Loading your tax summary…</p>}

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-base font-semibold text-gray-900">Tax packet for {year}</p>
          <p className="text-sm text-gray-500">
            Everything for the year on one printable page: totals, expenses, income, and invoices. Print it or save it as a PDF, and take it to your tax expert.
          </p>
        </div>
        <a
          href={`/dashboard/reports/tax-packet?year=${year}`}
          target="_blank"
          rel="noopener noreferrer"
          className="accent-bg inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap"
        >
          Open tax packet
          <ExternalLink className="h-4 w-4" />
        </a>
      </Card>

      <ReadinessCard checks={checks} />
      <OtherIncomeCard year={year} onChanged={() => setReloadKey((n) => n + 1)} />

      {summary && quarterly && (
        <>
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Schedule C summary, {summary.year}</h2>
                <p className="text-sm text-gray-500">
                  The federal form for sole proprietors and single-member LLCs. The same in every state.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={downloading !== null}
                onClick={() => download(`/api/reports/export/schedule-c/?year=${year}`, `mellax-schedule-c-${year}.csv`, "schedule-c")}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                {downloading === "schedule-c" ? "Preparing…" : "Download CSV"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Line</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.lines.map((row) => {
                    const bold = ["3", "5", "28", "31"].includes(row.line);
                    return (
                      <tr key={`${row.line}-${row.label}`} className={bold ? "font-semibold text-gray-900" : "text-gray-700"}>
                        <td className="py-2 pr-4 text-gray-500">{row.line}</td>
                        <td className="py-2 pr-4">{row.label}</td>
                        <td className="py-2 text-right">{money(row.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
              {summary.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Sales and sales tax by quarter, {quarterly.year}</h2>
              <p className="text-sm text-gray-500">
                Sales are counted by the day the invoice was issued. Payments are counted by the day they were received, before sales tax.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Quarter</th>
                    <th className="py-2 pr-4 text-right">Invoices</th>
                    <th className="py-2 pr-4 text-right">Sales</th>
                    <th className="py-2 pr-4 text-right">Taxable</th>
                    <th className="py-2 pr-4 text-right">Not taxable</th>
                    <th className="py-2 pr-4 text-right">Sales tax collected</th>
                    <th className="py-2 text-right">Payments received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quarterly.quarters.map((q) => (
                    <tr key={q.quarter} className="text-gray-700">
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {q.quarter}
                        <span className="block text-xs font-normal text-gray-500">
                          {q.start} to {q.end}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">{q.invoices}</td>
                      <td className="py-2 pr-4 text-right">{money(q.sales)}</td>
                      <td className="py-2 pr-4 text-right">{money(q.taxable_sales)}</td>
                      <td className="py-2 pr-4 text-right">{money(q.non_taxable_sales)}</td>
                      <td className="py-2 pr-4 text-right">{money(q.tax_collected)}</td>
                      <td className="py-2 text-right">{money(q.payments_received_ex_tax)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold text-gray-900">
                    <td className="py-2 pr-4">Year total</td>
                    <td className="py-2 pr-4 text-right">{quarterly.totals.invoices}</td>
                    <td className="py-2 pr-4 text-right">{money(quarterly.totals.sales)}</td>
                    <td className="py-2 pr-4 text-right">{money(quarterly.totals.taxable_sales)}</td>
                    <td className="py-2 pr-4 text-right">{money(quarterly.totals.non_taxable_sales)}</td>
                    <td className="py-2 pr-4 text-right">{money(quarterly.totals.tax_collected)}</td>
                    <td className="py-2 text-right">{money(quarterly.totals.payments_received_ex_tax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-600">
              Your sales tax rates in MellaX: {quarterly.service_tax_rate}% on services and {quarterly.product_tax_rate}% on products.
              Taxable means the service or product is marked taxable in MellaX.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
              {quarterly.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Where to file</p>
              {chosen ? (
                <>
                  <p>
                    Filing for <span className="font-semibold">{chosen.name}</span>, {filing.toLowerCase()}.
                  </p>
                  {chosen.territory ? (
                    <p>
                      U.S. territories run their own tax systems, which can differ from the states. Contact {chosen.name}&apos;s
                      revenue office for the exact form and due dates.
                    </p>
                  ) : (
                    <p>Each state sets its own form, due dates, and taxable services. Check your state&apos;s revenue department for the details.</p>
                  )}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`${chosen.name} department of revenue sales tax filing`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-gray-900 underline"
                  >
                    Find {chosen.name}&apos;s revenue department
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </>
              ) : (
                <p>Choose your state or territory above to see where to file.</p>
              )}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Downloads for your records</h2>
              <p className="text-sm text-gray-500">
                Each file is a spreadsheet (CSV). Opens in Excel, Google Sheets, and Numbers. Pick the dates first.
              </p>
            </div>
            <RangePicker value={range} onChange={setRange} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { kind: "payments", title: "Payments", hint: "Every payment and refund received, with the date and method." },
                { kind: "invoices", title: "Invoices", hint: "Every invoice issued, with its subtotal, sales tax, and total." },
                { kind: "expenses", title: "Expenses", hint: "Every expense, with its category and Schedule C line." },
                { kind: "clients", title: "Clients", hint: "Clients added in these dates, with their contact details." },
              ].map((file) => (
                <div key={file.kind} className="flex flex-col rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-gray-900">{file.title}</p>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-gray-500">{file.hint}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={downloading !== null}
                    onClick={() =>
                      download(`/api/reports/export/${file.kind}/?${rangeQuery}`, `mellax-${file.kind}-${range.start}-to-${range.end}.csv`, file.kind)
                    }
                    className="mt-4 gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    {downloading === file.kind ? "Preparing…" : "Download"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
