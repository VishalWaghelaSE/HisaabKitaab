import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { Bill, Recurrence } from "../lib/types";
import { formatCurrency, formatDate, daysUntil } from "../lib/format";
import { CATEGORIES } from "../lib/categories";
import Modal from "../components/Modal";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  NONE: "One-time",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

interface BillFormState {
  name: string;
  amount: string;
  category: string;
  dueDate: string;
  recurrence: Recurrence;
  reminderDaysBefore: string;
  notes: string;
}

const emptyForm: BillFormState = {
  name: "",
  amount: "",
  category: "General",
  dueDate: new Date().toISOString().slice(0, 10),
  recurrence: "NONE",
  reminderDaysBefore: "3",
  notes: "",
};

export default function Bills() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("unpaid");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [form, setForm] = useState<BillFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadBills() {
    setLoading(true);
    api
      .get<Bill[]>("/bills")
      .then((res) => setBills(res.data))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load bills")))
      .finally(() => setLoading(false));
  }

  useEffect(loadBills, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(bill: Bill) {
    setEditing(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      category: bill.category,
      dueDate: bill.dueDate.slice(0, 10),
      recurrence: bill.recurrence,
      reminderDaysBefore: String(bill.reminderDaysBefore),
      notes: bill.notes ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const amount = Number(form.amount);
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0 || !form.dueDate) {
      setFormError("Please fill in a valid name, amount and due date");
      return;
    }
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      amount,
      category: form.category,
      dueDate: new Date(form.dueDate).toISOString(),
      recurrence: form.recurrence,
      reminderDaysBefore: Number(form.reminderDaysBefore) || 0,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await api.put(`/bills/${editing.id}`, payload);
      } else {
        await api.post("/bills", payload);
      }
      setModalOpen(false);
      loadBills();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Unable to save bill"));
    } finally {
      setSubmitting(false);
    }
  }

  async function markPaid(bill: Bill) {
    try {
      await api.post(`/bills/${bill.id}/pay`);
      loadBills();
    } catch (err) {
      alert(apiErrorMessage(err, "Unable to mark bill as paid"));
    }
  }

  async function removeBill(bill: Bill) {
    if (!confirm(`Delete bill "${bill.name}"?`)) return;
    try {
      await api.delete(`/bills/${bill.id}`);
      loadBills();
    } catch (err) {
      alert(apiErrorMessage(err, "Unable to delete bill"));
    }
  }

  const filteredBills = bills.filter((b) => {
    if (filter === "paid") return b.isPaid;
    if (filter === "unpaid") return !b.isPaid;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bills</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Add bill
        </button>
      </div>

      <div className="flex gap-2">
        {(["unpaid", "paid", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-500 dark:text-slate-400">Loading...</p>}
      {error && <p className="text-rose-600 dark:text-rose-400">{error}</p>}

      {!loading && filteredBills.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No bills here yet.
        </p>
      )}

      <ul className="space-y-2">
        {filteredBills.map((bill) => {
          const d = daysUntil(bill.dueDate);
          const overdue = !bill.isPaid && d < 0;
          const dueSoon = !bill.isPaid && d >= 0 && d <= 3;
          return (
            <li
              key={bill.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-white">{bill.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {bill.category}
                  </span>
                  {bill.recurrence !== "NONE" && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                      {RECURRENCE_LABELS[bill.recurrence]}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Due {formatDate(bill.dueDate)}
                  {overdue && <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">Overdue</span>}
                  {dueSoon && <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">Due soon</span>}
                  {bill.isPaid && <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">Paid</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(bill.amount, currency)}
                </span>
                {!bill.isPaid && (
                  <button
                    onClick={() => markPaid(bill)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Mark paid
                  </button>
                )}
                <button
                  onClick={() => openEdit(bill)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeBill(bill)}
                  className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 dark:border-rose-900 dark:text-rose-400"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {modalOpen && (
        <Modal title={editing ? "Edit bill" : "Add bill"} onClose={() => setModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className={labelClass}>Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="Electricity bill"
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
                <label className={labelClass}>Due date</label>
                <input
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <label className={labelClass}>Repeats</label>
                <select
                  value={form.recurrence}
                  onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })}
                  className={inputClass}
                >
                  {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
                    <option key={r} value={r}>
                      {RECURRENCE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Remind me (days before due)</label>
              <input
                type="number"
                min="0"
                max="30"
                value={form.reminderDaysBefore}
                onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })}
                className={inputClass}
              />
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
              {submitting ? "Saving..." : editing ? "Save changes" : "Add bill"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
