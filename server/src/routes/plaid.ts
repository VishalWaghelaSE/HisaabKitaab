import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { plaidClient, plaidEnabled, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "../lib/plaid";
import { syncConnection } from "../lib/bankSync";

const router = Router();

router.get("/enabled", (_req, res) => {
  res.json({ enabled: plaidEnabled });
});

router.use(requireAuth);

function requirePlaid(res: Response): boolean {
  if (!plaidEnabled) {
    res.status(503).json({ error: "Bank connections aren't configured on the server (missing Plaid API keys)" });
    return false;
  }
  return true;
}

router.post("/link-token", async (req: AuthedRequest, res) => {
  if (!requirePlaid(res)) return;
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.userId as string },
      client_name: "HisaabKitaab",
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
    });
    res.json({ linkToken: response.data.link_token });
  } catch (err) {
    console.error("Plaid link-token creation failed:", err);
    res.status(502).json({ error: "Unable to create a Plaid link token" });
  }
});

const exchangeSchema = z.object({ publicToken: z.string().min(1) });

router.post("/exchange-public-token", async (req: AuthedRequest, res) => {
  if (!requirePlaid(res)) return;
  const parsed = exchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "publicToken is required" });
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: parsed.data.publicToken });
    const { access_token, item_id } = exchange.data;

    const [itemInfo, accountsInfo] = await Promise.all([
      plaidClient.itemGet({ access_token }),
      plaidClient.accountsGet({ access_token }),
    ]);

    const institutionName = itemInfo.data.item.institution_name ?? undefined;

    const connection = await prisma.bankConnection.create({
      data: {
        userId: req.userId as string,
        itemId: item_id,
        accessToken: access_token,
        institutionName,
      },
    });

    await prisma.bankAccount.createMany({
      data: accountsInfo.data.accounts.map((account) => ({
        connectionId: connection.id,
        plaidAccountId: account.account_id,
        name: account.name,
        mask: account.mask ?? null,
        type: account.type ?? null,
        subtype: account.subtype ?? null,
      })),
    });

    await syncConnection(connection.id);

    res.status(201).json({ ok: true, connectionId: connection.id });
  } catch (err) {
    console.error("Plaid public token exchange failed:", err);
    res.status(502).json({ error: "Unable to connect that account" });
  }
});

router.get("/connections", async (req: AuthedRequest, res) => {
  const connections = await prisma.bankConnection.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      institutionName: true,
      lastSyncedAt: true,
      createdAt: true,
      accounts: { select: { id: true, name: true, mask: true, type: true, subtype: true } },
    },
  });
  res.json(connections);
});

router.post("/connections/:id/sync", async (req: AuthedRequest, res) => {
  if (!requirePlaid(res)) return;
  const connection = await prisma.bankConnection.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!connection) return res.status(404).json({ error: "Connection not found" });

  try {
    await syncConnection(connection.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Manual bank sync failed:", err);
    res.status(502).json({ error: "Sync failed — try again in a moment" });
  }
});

router.delete("/connections/:id", async (req: AuthedRequest, res) => {
  const connection = await prisma.bankConnection.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!connection) return res.status(404).json({ error: "Connection not found" });

  if (plaidEnabled) {
    try {
      await plaidClient.itemRemove({ access_token: connection.accessToken });
    } catch (err) {
      console.error("Plaid item removal failed (continuing to delete locally):", err);
    }
  }

  await prisma.bankConnection.delete({ where: { id: connection.id } });
  res.status(204).send();
});

export default router;
