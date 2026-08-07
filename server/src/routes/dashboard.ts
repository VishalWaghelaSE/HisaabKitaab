import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req: AuthedRequest, res) => {
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [expenses, credits, bills] = await Promise.all([
    prisma.expense.findMany({
      where: { userId: req.userId, date: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.credit.findMany({
      where: { userId: req.userId, date: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.bill.findMany({ where: { userId: req.userId } }),
  ]);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);

  const categoryBreakdown: Record<string, number> = {};
  for (const e of expenses) {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] ?? 0) + e.amount;
  }

  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const upcomingBills = bills
    .filter((b) => !b.isPaid && b.dueDate >= now && b.dueDate <= sevenDaysFromNow)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const overdueBills = bills
    .filter((b) => !b.isPaid && b.dueDate < now)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // Last 6 months trend (including current month)
  const trend: { month: string; expenses: number; credits: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const [monthExpenses, monthCredits] = await Promise.all([
      prisma.expense.aggregate({
        where: { userId: req.userId, date: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.credit.aggregate({
        where: { userId: req.userId, date: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
    ]);
    trend.push({
      month: start.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      expenses: monthExpenses._sum.amount ?? 0,
      credits: monthCredits._sum.amount ?? 0,
    });
  }

  res.json({
    month,
    year,
    totalExpenses,
    totalCredits,
    net: totalCredits - totalExpenses,
    categoryBreakdown,
    upcomingBills,
    overdueBills,
    trend,
  });
});

export default router;
