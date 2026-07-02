import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { readDb, sortDesc, type Transaction } from "@/lib/server/data-store";
import { itemCostPrice, transactionProfit } from "@/lib/server/profit";

const delimiter = ";";
const utf8Bom = "\uFEFF";

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(delimiter);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const session = await requireAuth();
    const db = await readDb();

    let rows: Array<Transaction & { shopName?: string; cashierName?: string }> = [];
    let filenamePrefix = "kasirkita-transaksi";

    if (session.user.role === "owner") {
      const ownerShops = db.shops.filter((shop) => shop.ownerId === session.user.id);
      rows = db.transactions
        .filter((trx) => ownerShops.some((shop) => shop.id === trx.shopId))
        .map((trx) => ({
          ...trx,
          shopName: ownerShops.find((shop) => shop.id === trx.shopId)?.name,
          cashierName: db.users.find((user) => user.id === trx.cashierId)?.name,
        }));
      filenamePrefix = "kasirkita-owner-transaksi";
    } else {
      const scope = await getAdminScope(session.user.id);
      rows = db.transactions
        .filter((trx) => trx.shopId === scope.shopId && (session.user.role === "cashier" ? trx.cashierId === session.user.id : true))
        .map((trx) => ({
          ...trx,
          shopName: scope.shopName,
          cashierName: db.users.find((user) => user.id === trx.cashierId)?.name ?? session.user.name,
        }));
      filenamePrefix = `kasirkita-${scope.shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-transaksi`;
    }

    const lines: string[] = ["sep=;"];
    lines.push(csvRow(["Tanggal", "Order ID", "UMKM", "Kasir", "Metode", "Status", "Total", "Modal", "Laba Kotor", "Dibayar", "Kembalian", "Ref", "Catatan", "Item"]));

    sortDesc(rows).forEach((trx) => {
      const items = db.transactionItems
        .filter((item) => item.transactionId === trx.id)
        .map((item) => `${item.name} x${item.quantity} @ ${item.price} modal ${itemCostPrice(db, item)}`)
        .join(" | ");
      const profit = transactionProfit(db, trx);

      lines.push(csvRow([
        trx.createdAt,
        trx.id,
        trx.shopName,
        trx.cashierName,
        trx.paymentMethod,
        trx.status,
        trx.total,
        profit.costTotal,
        profit.grossProfit,
        trx.paidAmount ?? 0,
        trx.changeAmount ?? 0,
        trx.externalRef,
        trx.note,
        items,
      ]));
    });

    const filename = `${filenamePrefix}-${dateStamp()}.csv`;
    return new Response(`${utf8Bom}${lines.join("\r\n")}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const { message, status } = authError(error);
    return Response.json({ ok: false, error: { message } }, { status });
  }
}
