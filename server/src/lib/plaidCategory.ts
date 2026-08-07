// Maps Plaid's personal_finance_category.primary values onto this app's
// fixed category list (kept in sync with client/src/lib/categories.ts).
const PRIMARY_CATEGORY_MAP: Record<string, string> = {
  RENT_AND_UTILITIES: "Utilities",
  FOOD_AND_DRINK: "Groceries",
  TRANSPORTATION: "Transport",
  MEDICAL: "Health",
  PERSONAL_CARE: "Health",
  LOAN_PAYMENTS: "Loan/EMI",
  GENERAL_SERVICES: "Subscriptions",
  ENTERTAINMENT: "Entertainment",
  GENERAL_MERCHANDISE: "General",
  GOVERNMENT_AND_NON_PROFIT: "General",
  TRANSFER_IN: "General",
  TRANSFER_OUT: "General",
  TRAVEL: "Entertainment",
  BANK_FEES: "General",
  HOME_IMPROVEMENT: "General",
  INCOME: "General",
};

export function mapPlaidCategory(primary: string | null | undefined): string {
  if (!primary) return "General";
  return PRIMARY_CATEGORY_MAP[primary] ?? "General";
}
