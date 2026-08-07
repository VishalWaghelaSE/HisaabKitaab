import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { Expense } from "../lib/types";
import { formatCurrency, formatDate } from "../lib/format";
import { CATEGORIES } from "../lib/categories";
import Modal from "../components/Modal";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

interface ExpenseFormState {
  title: string;
  amount: string;
  category: string;
  date: string;
  notes: string;
}

const emptyForm: ExpenseFormState = {
  title: "",
  amount: "",
  category: "General",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function Expenses() {
  const { user } = useAuth();
  const currency = user?.currency ?? "CAD";
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Expense[]>("/expenses")
      .then((res) => setExpenses(res.data))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load expenses")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date.slice(0, 10),
      notes: expense.notes ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date) {
      setFormError("Please fill in a valid title, amount and date");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      amount,
      category: form.category,
      date: new Date(form.date).toISOString(),
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await api.put(`/expenses/${editing.id}`, payload);
      } else {
        await api.post("/expenses", payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Unable to save expense"));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeExpense(expense: Expense) {
    if (!confirm(`Delete expense "${expense.title}"?`)) return;
    try {
      await api.delete(`/expenses/${expense.id}`);
      load();
    } catch (err) {
      alert(apiErrorMessage(err, "Unable to delete expense"));
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total: {formatCurrency(total, currency)}</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Add expense
        </button>
      </div>

      {loading && <p className="text-slate-500 dark:text-slate-400">Loading...</p>}
      {error && <p className="text-rose-600 dark:text-rose-400">{error}</p>}

      {!loading && expenses.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No expenses recorded yet.
        </p>
      )}

      <ul className="space-y-2">
        {expenses.map((expense) => (
          <li
            key={expense.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white">{expense.title}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {expense.category}
                </span>
                {expense.billId && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    From bill
                  </span>
                )}
                {expense.plaidTransactionId && (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-600 dark:bg-teal-500/10 dark:text-teal-300">
                    Synced
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatDate(expense.date)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(expense.amount, currency)}
              </span>
              <button
                onClick={() => openEdit(expense)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Edit
              </button>
              <button
                onClick={() => removeExpense(expense)}
                className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 dark:border-rose-900 dark:text-rose-400"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <Modal title={editing ? "Edit expense" : "Add expense"} onClose={() => setModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className={labelClass}>Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass}
                placeholder="Groceries"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
                rows={2}
              />
            </div>

            {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? "Saving..." : editing ? "Save changes" : "Add expense"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
