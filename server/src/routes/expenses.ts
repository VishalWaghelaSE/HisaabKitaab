import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const expenseSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().min(1).max(50).optional(),
  date: z.string().min(1).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

router.get("/", async (req: AuthedRequest, res) => {
  const { month, year } = req.query;
  const where: any = { userId: req.userId };
  if (month && year) {
    const m = Number(month);
    const y = Number(year);
    where.date = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    };
  }
  const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" } });
  res.json(expenses);
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { title, amount, category, date, notes } = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      userId: req.userId as string,
      title,
      amount,
      category: category ?? "General",
      date: date ? new Date(date) : new Date(),
      notes: notes ?? null,
    },
  });
  res.status(201).json(expense);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const existing = await prisma.expense.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  const { title, amount, category, date, notes } = parsed.data;
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      ...(title !== undefined && { title }),
      ...(amount !== undefined && { amount }),
      ...(category !== undefined && { category }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(notes !== undefined && { notes }),
    },
  });
  res.json(expense);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.expense.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });
  await prisma.expense.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
