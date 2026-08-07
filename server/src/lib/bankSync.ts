import cron from "node-cron";
import { prisma } from "./prisma";
import { plaidClient, plaidEnabled } from "./plaid";
import { mapPlaidCategory } from "./plaidCategory";

function describeTransaction(tx: { merchant_name?: string | null; name: string }): string {
  return tx.merchant_name?.trim() || tx.name.trim() || "Transaction";
}

export async function syncConnection(connectionId: string): Promise<void> {
  const connection = await prisma.bankConnection.findUniqueOrThrow({ where: { id: connectionId } });

  let cursor = connection.cursor ?? undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: connection.accessToken,
      cursor,
    });
    const { added, modified, removed, next_cursor, has_more } = response.data;

    for (const tx of [...added, ...modified]) {
      const isExpense = tx.amount > 0;
      const amount = Math.abs(tx.amount);
      const category = mapPlaidCategory(tx.personal_finance_category?.primary);
      const title = describeTransaction(tx);
      const date = new Date(tx.date);

      if (isExpense) {
        await prisma.expense.upsert({
          where: { plaidTransactionId: tx.transaction_id },
          create: {
            userId: connection.userId,
            title,
            amount,
            category,
            date,
            plaidTransactionId: tx.transaction_id,
          },
          update: { title, amount, category, date },
        });
        await prisma.credit.deleteMany({ where: { plaidTransactionId: tx.transaction_id } });
      } else {
        await prisma.credit.upsert({
          where: { plaidTransactionId: tx.transaction_id },
          create: {
            userId: connection.userId,
            source: title,
            amount,
            date,
            plaidTransactionId: tx.transaction_id,
          },
          update: { source: title, amount, date },
        });
        await prisma.expense.deleteMany({ where: { plaidTransactionId: tx.transaction_id } });
      }
    }

    if (removed.length > 0) {
      const ids = removed.map((r) => r.transaction_id);
      await prisma.expense.deleteMany({ where: { plaidTransactionId: { in: ids } } });
      await prisma.credit.deleteMany({ where: { plaidTransactionId: { in: ids } } });
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  await prisma.bankConnection.update({
    where: { id: connection.id },
    data: { cursor, lastSyncedAt: new Date() },
  });
}

export async function syncAllConnections(): Promise<void> {
  if (!plaidEnabled) return;
  const connections = await prisma.bankConnection.findMany({ select: { id: true } });
  for (const { id } of connections) {
    try {
      await syncConnection(id);
    } catch (err) {
      console.error(`Bank sync failed for connection ${id}:`, err);
    }
  }
}

export function scheduleBankSyncJob(): void {
  if (!plaidEnabled) {
    console.warn("PLAID_CLIENT_ID/PLAID_SECRET not configured — bank connections are disabled.");
    return;
  }
  // Runs every 4 hours.
  cron.schedule("0 */4 * * *", () => {
    syncAllConnections().catch((err) => console.error("Bank sync job failed:", err));
  });
}
