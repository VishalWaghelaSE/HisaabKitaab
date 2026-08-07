import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { nextDueDate, Recurrence } from "../lib/recurrence";

const router = Router();
router.use(requireAuth);

const recurrenceEnum = z.enum(["NONE", "WEEKLY", "MONTHLY", "YEARLY"]);

const billSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().min(1).max(50).optional(),
  dueDate: z.string().datetime().or(z.string().min(1)),
  recurrence: recurrenceEnum.optional(),
  reminderDaysBefore: z.number().int().min(0).max(30).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

router.get("/", async (req: AuthedRequest, res) => {
  const bills = await prisma.bill.findMany({
    where: { userId: req.userId },
    orderBy: { dueDate: "asc" },
  });
  res.json(bills);
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = billSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { name, amount, category, dueDate, recurrence, reminderDaysBefore, notes } = parsed.data;
  const bill = await prisma.bill.create({
    data: {
      userId: req.userId as string,
      name,
      amount,
      category: category ?? "General",
      dueDate: new Date(dueDate),
      recurrence: recurrence ?? "NONE",
      reminderDaysBefore: reminderDaysBefore ?? 3,
      notes: notes ?? null,
    },
  });
  res.status(201).json(bill);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const parsed = billSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const existing = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Bill not found" });

  const { name, amount, category, dueDate, recurrence, reminderDaysBefore, notes } = parsed.data;
  const bill = await prisma.bill.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined && { name }),
      ...(amount !== undefined && { amount }),
      ...(category !== undefined && { category }),
      ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
      ...(recurrence !== undefined && { recurrence }),
      ...(reminderDaysBefore !== undefined && { reminderDaysBefore }),
      ...(notes !== undefined && { notes }),
    },
  });
  res.json(bill);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Bill not found" });
  await prisma.bill.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// Mark a bill as paid: logs an expense, and rolls recurring bills to their next due date.
router.post("/:id/pay", async (req: AuthedRequest, res) => {
  const bill = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!bill) return res.status(404).json({ error: "Bill not found" });

  await prisma.expense.create({
    data: {
      userId: req.userId as string,
      title: bill.name,
      amount: bill.amount,
      category: bill.category,
      date: new Date(),
      billId: bill.id,
    },
  });

  const updated =
    bill.recurrence === "NONE"
      ? await prisma.bill.update({ where: { id: bill.id }, data: { isPaid: true } })
      : await prisma.bill.update({
          where: { id: bill.id },
          data: { isPaid: false, dueDate: nextDueDate(bill.dueDate, bill.recurrence as Recurrence) },
        });

  res.json(updated);
});

export default router;
