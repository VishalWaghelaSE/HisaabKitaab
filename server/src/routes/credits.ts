import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const creditSchema = z.object({
  source: z.string().min(1).max(200),
  amount: z.number().positive(),
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
  const credits = await prisma.credit.findMany({ where, orderBy: { date: "desc" } });
  res.json(credits);
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = creditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { source, amount, date, notes } = parsed.data;
  const credit = await prisma.credit.create({
    data: {
      userId: req.userId as string,
      source,
      amount,
      date: date ? new Date(date) : new Date(),
      notes: notes ?? null,
    },
  });
  res.status(201).json(credit);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const parsed = creditSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const existing = await prisma.credit.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Credit not found" });

  const { source, amount, date, notes } = parsed.data;
  const credit = await prisma.credit.update({
    where: { id: existing.id },
    data: {
      ...(source !== undefined && { source }),
      ...(amount !== undefined && { amount }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(notes !== undefined && { notes }),
    },
  });
  res.json(credit);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.credit.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Credit not found" });
  await prisma.credit.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
