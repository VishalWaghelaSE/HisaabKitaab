-- AlterTable
ALTER TABLE "Credit" ADD COLUMN "plaidTransactionId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "plaidTransactionId" TEXT;

-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionName" TEXT,
    "cursor" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mask" TEXT,
    "type" TEXT,
    "subtype" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_itemId_key" ON "BankConnection"("itemId");

-- CreateIndex
CREATE INDEX "BankConnection_userId_idx" ON "BankConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_plaidAccountId_key" ON "BankAccount"("plaidAccountId");

-- CreateIndex
CREATE INDEX "BankAccount_connectionId_idx" ON "BankAccount"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Credit_plaidTransactionId_key" ON "Credit"("plaidTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_plaidTransactionId_key" ON "Expense"("plaidTransactionId");

