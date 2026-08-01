export const CATEGORIES = [
  "General",
  "Rent",
  "Utilities",
  "Groceries",
  "Transport",
  "Health",
  "Insurance",
  "Loan/EMI",
  "Subscriptions",
  "Education",
  "Entertainment",
  "Other",
];

export const CATEGORY_COLORS: Record<string, string> = {
  General: "#64748b",
  Rent: "#ef4444",
  Utilities: "#f97316",
  Groceries: "#eab308",
  Transport: "#22c55e",
  Health: "#14b8a6",
  Insurance: "#0ea5e9",
  "Loan/EMI": "#6366f1",
  Subscriptions: "#a855f7",
  Education: "#ec4899",
  Entertainment: "#f43f5e",
  Other: "#94a3b8",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#64748b";
}
