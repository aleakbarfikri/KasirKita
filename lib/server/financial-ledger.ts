import {
  createDataId,
  now,
  type AppDb,
  type FinancialLedgerEntry,
  type FinancialLedgerLine,
  type Transaction,
} from "@/lib/server/data-store";

type JournalInput = Omit<FinancialLedgerEntry, "id" | "currency" | "createdAt"> & {
  createdAt?: string;
};

function assertBalanced(lines: FinancialLedgerLine[]) {
  if (lines.length < 2) throw new Error("Ledger journal requires at least two lines.");
  for (const line of lines) {
    if (!Number.isSafeInteger(line.amount) || line.amount <= 0) {
      throw new Error("Ledger amount must be a positive safe integer.");
    }
  }
  const debit = lines.filter((line) => line.side === "debit").reduce((sum, line) => sum + line.amount, 0);
  const credit = lines.filter((line) => line.side === "credit").reduce((sum, line) => sum + line.amount, 0);
  if (debit !== credit) throw new Error(`Ledger journal is not balanced (${debit} != ${credit}).`);
}

/** Appends one immutable journal. journalKey makes provider retries idempotent. */
export function appendLedgerJournal(db: AppDb, input: JournalInput) {
  const existing = db.financialLedgerEntries.find((entry) => entry.journalKey === input.journalKey);
  if (existing) return { applied: false as const, entry: existing };
  assertBalanced(input.lines);
  const entry: FinancialLedgerEntry = {
    ...input,
    id: createDataId("ledger"),
    currency: "IDR",
    createdAt: input.createdAt ?? now(),
    ownerId: input.ownerId ?? null,
    adminId: input.adminId ?? null,
    shopId: input.shopId ?? null,
    transactionId: input.transactionId ?? null,
    lines: input.lines.map((line) => ({ ...line })),
  };
  db.financialLedgerEntries.push(entry);
  return { applied: true as const, entry };
}

function saleDebitAccount(method: Transaction["paymentMethod"]): FinancialLedgerLine["account"] {
  if (method === "cash") return "asset:cash";
  if (method === "qris_static") return "asset:qris_static";
  if (method === "qris_pakasir") return "asset:qris_pakasir";
  return "asset:accounts_receivable";
}

export function recordSuccessfulSale(
  db: AppDb,
  transaction: Transaction,
  scope: { ownerId?: string | null; adminId?: string | null },
) {
  if (transaction.total <= 0) return { applied: false as const, entry: null };
  return appendLedgerJournal(db, {
    journalKey: `sale:${transaction.id}`,
    ownerId: scope.ownerId,
    adminId: scope.adminId,
    shopId: transaction.shopId,
    transactionId: transaction.id,
    sourceType: "transaction",
    sourceId: transaction.id,
    description: `Penjualan ${transaction.paymentMethod} ${transaction.id}`,
    lines: [
      { account: saleDebitAccount(transaction.paymentMethod), side: "debit", amount: transaction.total },
      { account: "income:sales", side: "credit", amount: transaction.total },
    ],
    createdAt: transaction.updatedAt || transaction.createdAt,
  });
}

export function recordTransactionVoid(
  db: AppDb,
  transaction: Transaction,
  scope: { ownerId?: string | null; adminId?: string | null },
) {
  if (transaction.total <= 0) return { applied: false as const, entry: null };
  return appendLedgerJournal(db, {
    journalKey: `void:${transaction.id}`,
    ownerId: scope.ownerId,
    adminId: scope.adminId,
    shopId: transaction.shopId,
    transactionId: transaction.id,
    sourceType: "transaction",
    sourceId: transaction.id,
    description: `Pembalikan penjualan ${transaction.id}`,
    lines: [
      { account: "income:sales", side: "debit", amount: transaction.total },
      { account: saleDebitAccount(transaction.paymentMethod), side: "credit", amount: transaction.total },
    ],
  });
}

export function recordDebtPayment(
  db: AppDb,
  input: { paymentId: string; debtId: string; amount: number; ownerId: string; adminId: string; shopId: string },
) {
  return appendLedgerJournal(db, {
    journalKey: `debt-payment:${input.paymentId}`,
    ownerId: input.ownerId,
    adminId: input.adminId,
    shopId: input.shopId,
    sourceType: "debt_payment",
    sourceId: input.paymentId,
    description: `Penerimaan pembayaran piutang ${input.debtId}`,
    lines: [
      { account: "asset:cash", side: "debit", amount: input.amount },
      { account: "asset:accounts_receivable", side: "credit", amount: input.amount },
    ],
  });
}

export function recordWithdrawalSettlement(
  db: AppDb,
  input: { withdrawalId: string; amount: number; ownerId: string; adminId: string },
) {
  return appendLedgerJournal(db, {
    journalKey: `withdrawal:${input.withdrawalId}`,
    ownerId: input.ownerId,
    adminId: input.adminId,
    sourceType: "withdrawal",
    sourceId: input.withdrawalId,
    description: `Settlement penarikan ${input.withdrawalId}`,
    lines: [
      { account: "asset:settlement_bank", side: "debit", amount: input.amount },
      { account: "asset:qris_pakasir", side: "credit", amount: input.amount },
    ],
  });
}

export function recordSubscriptionRevenue(
  db: AppDb,
  input: { invoiceId: string; amount: number; ownerId: string; adminId: string; shopId: string },
) {
  return appendLedgerJournal(db, {
    journalKey: `subscription:${input.invoiceId}`,
    ownerId: input.ownerId,
    adminId: input.adminId,
    shopId: input.shopId,
    sourceType: "subscription_invoice",
    sourceId: input.invoiceId,
    description: `Pembayaran subscription ${input.invoiceId}`,
    lines: [
      { account: "asset:qris_pakasir", side: "debit", amount: input.amount },
      { account: "income:subscription", side: "credit", amount: input.amount },
    ],
  });
}

export function verifyLedger(entries: FinancialLedgerEntry[]) {
  const journalKeys = new Set<string>();
  for (const entry of entries) {
    if (journalKeys.has(entry.journalKey)) throw new Error(`Duplicate ledger journal: ${entry.journalKey}`);
    journalKeys.add(entry.journalKey);
    assertBalanced(entry.lines);
  }
  return { entries: entries.length, balanced: true as const };
}
