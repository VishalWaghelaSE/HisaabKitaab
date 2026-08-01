import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import billRoutes from "./routes/bills";
import expenseRoutes from "./routes/expenses";
import creditRoutes from "./routes/credits";
import dashboardRoutes from "./routes/dashboard";
import pushRoutes from "./routes/push";
import { scheduleReminderJob } from "./lib/reminders";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/push", pushRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`HisaabKitaab API listening on port ${port}`);
  scheduleReminderJob();
});
