import { authError, requireOwner } from "@/lib/server/auth-guard";
import { publicUser, readDb } from "@/lib/server/data-store";

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function rupiahNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export async function GET() {
  try {
    const session = await requireOwner();
    const ownerId = session.user.id;
    const db = await readDb();
    const ownerShops = db.shops.filter((shop) => shop.ownerId === ownerId);
    const admins = db.adminProfiles
      .filter((profile) => profile.ownerId === ownerId)
      .map((profile) => ({ profile, user: db.users.find((user) => user.id === profile.userId), shop: db.shops.find((shop) => shop.id === profile.shopId), balance: db.balances.find((balance) => balance.adminId === profile.userId) }))
      .filter((row) => row.user && row.shop);
    const transactions = db.transactions
      .filter((trx) => ownerShops.some((shop) => shop.id === trx.shopId))
      .map((trx) => ({ ...trx, shop: ownerShops.find((shop) => shop.id === trx.shopId)!, cashier: db.users.find((user) => user.id === trx.cashierId)!, items: db.transactionItems.filter((item) => item.transactionId === trx.id) }));
    const withdrawals = db.withdrawals
      .filter((row) => row.ownerId === ownerId)
      .map((row) => ({ ...row, admin: db.users.find((user) => user.id === row.adminId)! }));
    const debts = db.debts
      .filter((debt) => ownerShops.some((shop) => shop.id === debt.shopId))
      .map((debt) => ({ ...debt, shop: ownerShops.find((shop) => shop.id === debt.shopId)!, admin: db.users.find((user) => user.id === debt.adminId)! }));

    const totalRevenue = transactions.filter((row) => row.status === "success").reduce((sum, row) => sum + row.total, 0);
    const totalDigital = admins.reduce((sum, row) => sum + ((row.balance?.totalEarnedQrisApi ?? 0) - (row.balance?.totalWithdrawn ?? 0)), 0);
    const pendingWithdrawal = withdrawals.filter((row) => row.status !== "completed").reduce((sum, row) => sum + row.amount, 0);
    const outstandingDebt = debts.filter((row) => row.status !== "paid").reduce((sum, row) => sum + row.amount - row.paidAmount, 0);

    const lines: string[] = [];
    lines.push(csvRow(["KASIRKITA OWNER REPORT"]));
    lines.push(csvRow(["Downloaded At", new Date()]));
    lines.push(csvRow(["Owner", session.user.name]));
    lines.push("");
    lines.push(csvRow(["Ringkasan", "Nilai"]));
    lines.push(csvRow(["Total Pendapatan Sukses", rupiahNumber(totalRevenue)]));
    lines.push(csvRow(["Saldo QRIS Digital", rupiahNumber(totalDigital)]));
    lines.push(csvRow(["Withdrawal Belum Selesai", rupiahNumber(pendingWithdrawal)]));
    lines.push(csvRow(["Piutang Aktif", rupiahNumber(outstandingDebt)]));
    lines.push("");

    lines.push(csvRow(["ADMIN UMKM"]));
    lines.push(csvRow(["Nama Admin", "Username", "Email", "UMKM", "Alamat", "Status", "Saldo QRIS", "Total Withdrawn"]));
    admins.forEach((row) => {
      const user = row.user!;
      const shop = row.shop!;
      const balance = row.balance;
      lines.push(csvRow([
        user.name,
        user.username,
        user.email,
        shop.name,
        shop.address,
        row.profile.isActive ? "Aktif" : "Nonaktif",
        rupiahNumber((balance?.totalEarnedQrisApi ?? 0) - (balance?.totalWithdrawn ?? 0)),
        rupiahNumber(balance?.totalWithdrawn ?? 0),
      ]));
    });
    lines.push("");

    lines.push(csvRow(["TRANSAKSI"]));
    lines.push(csvRow(["Tanggal", "UMKM", "Kasir", "Metode", "Status", "Total", "Dibayar", "Kembalian", "Item"]));
    transactions.forEach((row) => {
      lines.push(csvRow([
        row.createdAt,
        row.shop.name,
        row.cashier?.name,
        row.paymentMethod,
        row.status,
        rupiahNumber(row.total),
        rupiahNumber(row.paidAmount ?? 0),
        rupiahNumber(row.changeAmount ?? 0),
        row.items.map((item) => `${item.name} x${item.quantity}`).join("; "),
      ]));
    });
    lines.push("");

    lines.push(csvRow(["WITHDRAWAL"]));
    lines.push(csvRow(["Tanggal", "Admin", "Jumlah", "Bank", "No Rekening", "Atas Nama", "Status", "Selesai Pada"]));
    withdrawals.forEach((row) => {
      lines.push(csvRow([row.createdAt, row.admin?.name, rupiahNumber(row.amount), row.bankName, row.accountNumber, row.accountName, row.status, row.completedAt]));
    });
    lines.push("");

    lines.push(csvRow(["PIUTANG / HUTANG PELANGGAN"]));
    lines.push(csvRow(["Tanggal", "UMKM", "Admin", "Pelanggan", "No HP", "Jumlah", "Dibayar", "Sisa", "Status", "Jatuh Tempo", "Catatan"]));
    debts.forEach((row) => {
      lines.push(csvRow([row.createdAt, row.shop.name, row.admin?.name, row.customerName, row.customerPhone, rupiahNumber(row.amount), rupiahNumber(row.paidAmount), rupiahNumber(row.amount - row.paidAmount), row.status, row.dueDate, row.note]));
    });

    const filename = `kasirkita-owner-report-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(lines.join("\n"), {
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
