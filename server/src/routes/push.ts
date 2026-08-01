import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { pushEnabled, webpush } from "../lib/push";

const router = Router();

router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

router.use(requireAuth);

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.post("/subscribe", async (req: AuthedRequest, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid subscription payload" });
  }
  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.userId as string, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: req.userId as string, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json({ ok: true });
});

router.post("/unsubscribe", async (req: AuthedRequest, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) return res.status(400).json({ error: "endpoint is required" });
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
  res.status(204).send();
});

router.post("/test", async (req: AuthedRequest, res) => {
  if (!pushEnabled) {
    return res.status(503).json({ error: "Push notifications are not configured on the server (missing VAPID keys)" });
  }
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: req.userId } });
  if (subscriptions.length === 0) {
    return res.status(404).json({ error: "No push subscription found for this device" });
  }
  const payload = JSON.stringify({
    title: "HisaabKitaab",
    body: "This is a test notification. Reminders will look like this.",
  });
  await Promise.all(
    subscriptions.map((sub) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        .catch((err) => console.error("Test push failed:", err?.message ?? err))
    )
  );
  res.json({ ok: true });
});

export default router;
