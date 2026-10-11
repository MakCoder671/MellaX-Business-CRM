"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { isoDay, money, type Expense, type ExpenseCategory } from "@/lib/reports";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { ReportHelp } from "./ReportHelp";
import { presetRanges, RangePicker, type DateRange } from "./RangePicker";

// Expenses are what the business spends to run: rent, supplies, ads, software.
// Logging them is what turns sales into real profit, and the tax center groups
// them by the categories on IRS Schedule C.

type RepeatingExpense = {
  id: number;
  amount: string;
  category: string;
  category_label: string;
  description: string;
  vendor: string;
  start_date: string;
};

type FormState = {
  date: string;
  amount: string;
  category: string;
  description: string;
  vendor: string;
  note: string;
};

function emptyForm(): FormState {
  return { date: isoDay(new Date()), amount: "", category: "supplies", description: "", vendor: "", note: "" };
}

export function ExpensesPanel() {
  const [range, setRange] = useState<DateRange>(() => presetRanges()[0]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [result, setResult] = useState<{ key: string; expenses: Expense[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [repeating, setRepeating] = useState<RepeatingExpense[] | null>(null);

  const key = `${range.start}|${range.end}|${reloadKey}`;
  const expenses = result?.key === key ? result.expenses : null;

  useEffect(() => {
    apiFetch<ExpenseCategory[]>("/api/reports/expense-categories/")
      .then(setCategories)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load the categories."));
  }, []);

  useEffect(() => {
    apiFetch<RepeatingExpense[]>("/api/reports/recurring-expenses/")
      .then(setRepeating)
      .catch(() => setRepeating([]));
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Expense[]>(`/api/reports/expenses/?start=${range.start}&end=${range.end}`)
      .then((data) => {
        if (!cancelled) setResult({ key, expenses: data });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Couldn't load your expenses.");
      });
    return () => {
      cancelled = true;
    };
  }, [key, range.start, range.end]);

  const selectedCategory = categories.find((c) => c.key === form.category);

  // Totals per category for the dates on screen. Categories with nothing logged still appear, at zero.
  const totals = categories.map((category) => {
    const rows = (expenses ?? []).filter((e) => e.category === category.key);
    return {
      category,
      count: rows.length,
      total: rows.reduce((sum, e) => sum + Number(e.amount), 0),
    };
  });
  const grandTotal = totals.reduce((sum, row) => sum + row.total, 0);

  function startNew() {
    setEditingId(null);
    setRepeat(false);
    setForm(emptyForm());
    setFormError(null);
    setShowForm(true);
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setRepeat(false);
    setForm({
      date: expense.date,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      vendor: expense.vendor,
      note: expense.note,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const body = { ...form, amount: form.amount };
    try {
      if (editingId === null && repeat) {
        // A repeating cost: MellaX adds one entry for each month, starting on this date.
        await apiFetch("/api/reports/recurring-expenses/", {
          method: "POST",
          body: { ...body, start_date: form.date },
        });
      } else if (editingId === null) {
        await apiFetch("/api/reports/expenses/", { method: "POST", body });
      } else {
        await apiFetch(`/api/reports/expenses/${editingId}/`, { method: "PATCH", body });
      }
      setShowForm(false);
      setEditingId(null);
      setRepeat(false);
      setForm(emptyForm());
      setReloadKey((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save that expense. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function stopRepeating(item: RepeatingExpense) {
    if (!confirm(`Stop repeating “${item.description}”? Months already logged stay. Future months won't be added.`)) return;
    try {
      await apiFetch(`/api/reports/recurring-expenses/${item.id}/`, { method: "DELETE" });
      setReloadKey((n) => n + 1);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't stop that repeat. Try again.");
    }
  }

  async function remove(expense: Expense) {
    if (!confirm(`Delete “${expense.description}” for ${money(expense.amount)}? This can't be undone.`)) return;
    try {
      await apiFetch(`/api/reports/expenses/${expense.id}/`, { method: "DELETE" });
      setReloadKey((n) => n + 1);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't delete that expense.");
    }
  }

  return (
    <div className="space-y-6">
      <ReportHelp
        shows={[
          "Every expense you logged in the dates you pick, with its category and its Schedule C line number.",
          "Totals for each category, so you can see where the money goes.",
          "The grand total, which the profit report subtracts from your sales.",
        ]}
        howToRead={[
          "Log an expense on the day you paid for it. Travel, meals, supplies, repairs, and every other category are in the category list.",
          "For a cost that repeats every month, like equipment upkeep, tick Repeat this every month so you only enter it once.",
          "Pick the category that fits best. The hint under the category explains what belongs there.",
          "The Schedule C line is the number your accountant uses on the tax form. You don't need to know it to log an expense.",
        ]}
        leavesOut={[
          "Your own pay as a sole proprietor. Owner draws aren't business expenses.",
          "Income tax and personal costs. Only costs of running the business belong here.",
          "Meal costs are logged in full. Your accountant decides how much of them is deductible.",
          "Costs you pay for each sale, like gloves or product, go under Services or Products, not here.",
        ]}
      />

      <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
        <RangePicker value={range} onChange={setRange} />
        <Button type="button" onClick={startNew} className="gap-1.5 whitespace-nowrap">
          <Plus className="h-4 w-4" />
          Log an expense
        </Button>
      </Card>

      <ErrorText>{loadError}</ErrorText>

      {showForm && (
        <Card className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{editingId === null ? "Log an expense" : "Change this expense"}</h2>
              <p className="text-sm text-gray-500">Fill in the first four boxes at minimum. The rest help you remember later.</p>
            </div>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Date paid" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Field
              label="Amount ($)"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label} (line {c.line})
                    </option>
                  ))}
                </select>
              </label>
              {selectedCategory && (
                <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="font-semibold">{selectedCategory.label}:</span> {selectedCategory.hint}.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Field
                label="What was it for?"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <Field label="Who did you pay? (optional)" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            <Field label="A note for later (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {editingId === null && (
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm sm:col-span-2">
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="mt-1" />
                <span>
                  <span className="font-semibold text-gray-900">Repeat this every month</span>
                  <span className="block text-gray-500">
                    For costs that come back each month, like rent, software, or a mower service plan. MellaX adds one entry
                    each month, on the same day as the date above, until you stop it.
                  </span>
                </span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId === null ? "Save expense" : "Save changes"}
              </Button>
              <ErrorText>{formError}</ErrorText>
            </div>
          </form>
        </Card>
      )}

      {repeating && repeating.length > 0 && (
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Repeating every month</h2>
            <p className="text-sm text-gray-500">These are added for you each month. Stop one here when it ends.</p>
          </div>
          <ul className="divide-y divide-gray-100 text-sm">
            {repeating.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <p className="text-xs text-gray-500">
                    {item.category_label} · {money(item.amount)} a month · since {item.start_date}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => stopRepeating(item)}>
                  Stop repeating
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="space-y-3 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-gray-900">By category</h2>
            <p className="text-sm font-semibold text-gray-900">Total {money(grandTotal)}</p>
          </div>
          <ul className="divide-y divide-gray-100 text-sm">
            {totals.map((row) => (
              <li key={row.category.key} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className={row.count ? "font-medium text-gray-900" : "text-gray-400"}>{row.category.label}</p>
                  <p className="text-xs text-gray-400">Schedule C line {row.category.line}</p>
                </div>
                <div className="text-right">
                  <p className={row.count ? "text-gray-900" : "text-gray-400"}>{money(row.total)}</p>
                  <p className="text-xs text-gray-400">{row.count} logged</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-base font-semibold text-gray-900">Logged expenses</h2>
          {expenses === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing logged in these dates yet. Use “Log an expense” to add one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">For</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="py-2 pr-3 text-gray-700">{expense.date}</td>
                      <td className="py-2 pr-3 text-gray-700">{expense.category_label}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-900">{expense.description}</p>
                        {expense.vendor && <p className="text-xs text-gray-500">{expense.vendor}</p>}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-900">{money(expense.amount)}</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => startEdit(expense)} aria-label="Change expense" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => remove(expense)} aria-label="Delete expense" className="rounded-md p-1.5 text-gray-500 hover:bg-rose-50 hover:text-rose-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
