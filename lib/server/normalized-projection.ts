import type { AppDb } from "@/lib/server/data-store";

export type NormalizedEntityRow = {
  entityType: keyof AppDb;
  entityId: string;
  shopId: string | null;
  ownerId: string | null;
  adminId: string | null;
  payload: Record<string, unknown>;
};

function idFor(type: keyof AppDb, row: Record<string, unknown>) {
  const stableId = row.id ?? row.userId ?? row.adminId ?? row.ownerId ?? row.shopId ?? row.transactionId ?? row.debtId;
  if (stableId === undefined || stableId === null || String(stableId).trim() === "") {
    throw new Error(`Normalized projection cannot derive an id for ${type}.`);
  }
  return String(stableId);
}

export function projectNormalizedRows(db: AppDb): NormalizedEntityRow[] {
  const adminByUser = new Map(db.adminProfiles.map((row) => [row.userId, row]));
  const cashierByUser = new Map(db.cashierProfiles.map((row) => [row.userId, row]));
  const transactionById = new Map(db.transactions.map((row) => [row.id, row]));
  const debtById = new Map(db.debts.map((row) => [row.id, row]));

  return (Object.entries(db) as Array<[keyof AppDb, AppDb[keyof AppDb]]>).flatMap(([entityType, entities]) =>
    entities.map((entity) => {
      const row = entity as unknown as Record<string, unknown>;
      const userId = String(row.userId ?? row.id ?? "");
      const adminProfile = adminByUser.get(userId);
      const cashierProfile = cashierByUser.get(userId);
      const transaction = row.transactionId ? transactionById.get(String(row.transactionId)) : undefined;
      const debt = row.debtId ? debtById.get(String(row.debtId)) : undefined;
      return {
        entityType,
        entityId: idFor(entityType, row),
        shopId: String(row.shopId ?? adminProfile?.shopId ?? cashierProfile?.shopId ?? transaction?.shopId ?? debt?.shopId ?? "") || null,
        ownerId: String(row.ownerId ?? adminProfile?.ownerId ?? cashierProfile?.ownerId ?? "") || null,
        adminId: String(row.adminId ?? cashierProfile?.adminId ?? (adminProfile ? adminProfile.userId : "") ?? "") || null,
        payload: row,
      };
    }),
  );
}
