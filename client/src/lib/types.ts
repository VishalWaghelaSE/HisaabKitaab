export type Recurrence = "NONE" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  category: string;
  dueDate: string;
  recurrence: Recurrence;
  reminderDaysBefore: number;
  isPaid: boolean;
  notes: string | null;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string | null;
  billId: string | null;
  plaidTransactionId: string | null;
}

export interface Credit {
  id: string;
  source: string;
  amount: number;
  date: string;
  notes: string | null;
  plaidTransactionId: string | null;
}

export interface BankAccount {
  id: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
}

export interface BankConnection {
  id: string;
  institutionName: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  accounts: BankAccount[];
}

export interface DashboardSummary {
  month: number;
  year: number;
  totalExpenses: number;
  totalCredits: number;
  net: number;
  categoryBreakdown: Record<string, number>;
  upcomingBills: Bill[];
  overdueBills: Bill[];
  trend: { month: string; expenses: number; credits: number }[];
}
