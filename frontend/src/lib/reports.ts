// Shapes of what the reports endpoints send, plus the small helpers every
// report tab shares (money formatting, file downloads). One place, so the
// tabs all read the numbers the same way.
import { API_BASE_URL, ApiError } from "./api";

export type PeriodMetrics = {
  start: string;
  end: string;
  gross_received: number;
  refunds: number;
  net_revenue: number;
  sales_tax_collected: number;
  paid_invoices: number;
  average_ticket: number;
  clients_served: number;
  new_clients: number;
  returning_clients: number;
  returning_rate: number;
  cost_of_goods: number;
  products_without_cost: number;
  expenses: number;
  profit: number;
};

export type MonthRow = PeriodMetrics & { label: string; is_partial: boolean };

export type GrowthReport = {
  current: PeriodMetrics;
  last_year: PeriodMetrics;
  changes: {
    net_revenue: number | null;
    average_ticket: number | null;
    paid_invoices: number | null;
    clients_served: number | null;
    profit: number | null;
  };
  bookings: { bookings: number; cancelled: number; no_shows: number; cancelled_rate: number; no_show_rate: number };
  busiest: { by_weekday: { day: string; bookings: number }[]; by_hour: { hour: number; bookings: number }[] };
  top_services: { name: string; revenue: number; lines_sold: number; share: number }[];
  lapsed: {
    over_60_days: number;
    over_90_days: number;
    list: { name: string; client_id: number; last_visit: string; days_since: number; visits: number }[];
  };
};

export type ExpenseCategory = { key: string; label: string; line: string; hint: string };

export type Expense = {
  id: number;
  date: string;
  amount: string;
  category: string;
  category_label: string;
  schedule_c_line: string | null;
  description: string;
  vendor: string;
  note: string;
  created_at: string;
};

export type TaxYear = {
  year: number;
  lines: { line: string; label: string; amount: number; category?: string }[];
  totals: Record<string, number>;
  sales_tax_collected: number;
  notes: string[];
};

export type TaxQuarters = {
  year: number;
  service_tax_rate: string;
  product_tax_rate: string;
  quarters: {
    quarter: string;
    start: string;
    end: string;
    invoices: number;
    sales: number;
    taxable_sales: number;
    non_taxable_sales: number;
    tax_collected: number;
    payments_received_ex_tax: number;
  }[];
  totals: Record<string, number>;
  notes: string[];
};

// Turns 1234.5 or "1234.50" into "$1,234.50", and keeps a minus sign in the right place.
export function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  const formatted = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

// A percent change with an explicit plus sign, or a dash when there's nothing to compare with.
export function changeText(value: number | null | undefined) {
  if (value === null || value === undefined) return "Nothing to compare with last year";
  // Very large jumps come from a small base last year, so a huge percentage would mislead more than help.
  if (value > 500) return "Much higher than last year";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}% vs last year`;
}

export function percent(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

// Date helpers for the range presets. Dates are YYYY-MM-DD in the browser's own time zone.
export function isoDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Downloads a CSV from the reports API. The token travels in the header, so the file stays private.
export async function downloadFile(path: string, filename: string) {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem("mellax_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, { detail: "We couldn't make that file. Check the dates and try again." });
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
