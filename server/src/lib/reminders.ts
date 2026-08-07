import cron from "node-cron";
import { prisma } from "./prisma";
import { pushEnabled, webpush } from "./push";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export async function sendDueBillReminders() {
  if (!pushEnabled) return;

  const now = new Date();
  const bills = await prisma.bill.findMany({ where: { isPaid: false } });

  for (const bill of bills) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntilDue = Math.ceil((bill.dueDate.getTime() - now.getTime()) / msPerDay);
    const shouldRemind = daysUntilDue <= bill.reminderDaysBefore;
    const alreadyRemindedToday = bill.lastReminderSentAt && isSameDay(bill.lastReminderSentAt, now);

    if (!shouldRemind || alreadyRemindedToday) continue;

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: bill.userId } });
    if (subscriptions.length === 0) continue;

    const title = daysUntilDue < 0 ? `Overdue: ${bill.name}` : daysUntilDue === 0 ? `Due today: ${bill.name}` : `Due in ${daysUntilDue} day(s): ${bill.name}`;
    const payload = JSON.stringify({
      title,
      body: `${bill.category} · ₹${bill.amount.toFixed(2)} due ${bill.dueDate.toDateString()}`,
      billId: bill.id,
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("Push notification failed:", err?.message ?? err);
        }
      }
    }

    await prisma.bill.update({ where: { id: bill.id }, data: { lastReminderSentAt: now } });
  }
}

export function scheduleReminderJob() {
  if (!pushEnabled) {
    console.warn("VAPID keys not configured — bill reminder push notifications are disabled.");
    return;
  }
  // Runs every day at 8:00 AM server time.
  cron.schedule("0 8 * * *", () => {
    sendDueBillReminders().catch((err) => console.error("Reminder job failed:", err));
  });
}
