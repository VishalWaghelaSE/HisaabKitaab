import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { DashboardSummary } from "../lib/types";
import { formatCurrency, formatDate, daysUntil } from "../lib/format";
import { categoryColor } from "../lib/categories";
import StatCard from "../components/StatCard";

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardSummary>("/dashboard/summary")
      .then((res) => setSummary(res.data))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load dashboard")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading dashboard...</p>;
  if (error) return <p className="text-rose-600 dark:text-rose-400">{error}</p>;
  if (!summary) return null;

  const currency = user?.currency ?? "CAD";
  const categoryData = Object.entries(summary.categoryBreakdown).map(([name, value]) => ({ name, value }));
  const monthLabel = new Date(summary.year, summary.month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{monthLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Expenses" value={formatCurrency(summary.totalExpenses, currency)} tone="negative" />
        <StatCard label="Income" value={formatCurrency(summary.totalCredits, currency)} tone="positive" />
        <StatCard
          label="Net"
          value={formatCurrency(summary.net, currency)}
          tone={summary.net >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Overdue bills" value={String(summary.overdueBills.length)} tone={summary.overdueBills.length ? "negative" : "default"} />
      </div>

      {(summary.overdueBills.length > 0 || summary.upcomingBills.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.overdueBills.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
              <h2 className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-300">Overdue bills</h2>
              <ul className="space-y-2">
                {summary.overdueBills.map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{bill.name}</span>
                    <span className="font-medium text-rose-700 dark:text-rose-300">
                      {formatCurrency(bill.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/bills" className="mt-3 inline-block text-xs font-medium text-rose-700 underline dark:text-rose-300">
                Go to bills
              </Link>
            </div>
          )}

          {summary.upcomingBills.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
              <h2 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-300">Upcoming (next 7 days)</h2>
              <ul className="space-y-2">
                {summary.upcomingBills.map((bill) => {
                  const d = daysUntil(bill.dueDate);
                  return (
                    <li key={bill.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-200">
                        {bill.name} <span className="text-slate-400">({formatDate(bill.dueDate)})</span>
                      </span>
                      <span className="font-medium text-amber-700 dark:text-amber-300">
                        {d === 0 ? "Today" : `in ${d}d`} · {formatCurrency(bill.amount, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link to="/bills" className="mt-3 inline-block text-xs font-medium text-amber-700 underline dark:text-amber-300">
                Go to bills
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Last 6 months</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={40} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} />
              <Legend />
              <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="credits" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Expenses by category</h2>
          {categoryData.length === 0 ? (
            <p className="flex h-[220px] items-center justify-center text-sm text-slate-400">No expenses yet this month</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={categoryColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
