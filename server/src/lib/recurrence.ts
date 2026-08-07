export type Recurrence = "NONE" | "WEEKLY" | "MONTHLY" | "YEARLY";

export function nextDueDate(date: Date, recurrence: Recurrence): Date {
  const next = new Date(date);
  switch (recurrence) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      break;
  }
  return next;
}
