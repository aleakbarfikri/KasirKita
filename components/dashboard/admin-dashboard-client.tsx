"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, NotebookTabs, ReceiptText, Store, TrendingUp, Wallet } from "lucide-react";
import { api, debtStatusLabel, paymentMethodLabel, transactionStatusLabel, type DebtRecord, type TransactionRecord, type WithdrawalRecord } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useAppLanguage } from "@/lib/i18n";

function statusVariant(status: TransactionRecord["status"]) {
  if (status === "success") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "cancelled") return "secondary" as const;
  return "danger" as const;
}

function shortOrderId(id?: string | null) {
  if (!id) return "-";

  const cleanId = id.replace(/^trx_/i, "");
  const shortId = cleanId.slice(0, 6).toUpperCase();

  return shortId ? `TRX-${shortId}` : "-";
}

function MetricRow({
  title,
  value,
  helper,
  icon: Icon,
  tone = "green",
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof Store;
  tone?: "green" | "blue" | "navy" | "red";
}) {
  const toneClass = {
    green: "text-primary bg-primary/10",
    blue: "text-[#00628d] bg-[#c9e6ff]",
    navy: "text-[#213145] bg-[#dae2fd]",
    red: "text-red-700 bg-red-100",
  }[tone];
  const valueClass = {
    green: "text-primary",
    blue: "text-[#0875c9]",
    navy: "text-[#0b1c30]",
    red: "text-red-600",
  }[tone];

  return (
    <div className="grid min-w-0 gap-4 rounded-2xl border border-[#e7edf0] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(11,28,48,0.04)] sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon className="h-8 w-8" />
      </div>
      <div className="min-w-0 border-[#dfe7e3] sm:border-l sm:pl-7">
        <p className="text-lg font-black leading-tight text-[#0b1c30]">{title}</p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-[#4f5d56] sm:text-base">{helper}</p>
      </div>
      <p className={`min-w-0 break-words text-left text-3xl font-black tracking-normal sm:whitespace-nowrap sm:text-right sm:text-4xl ${valueClass}`}>{value}</p>
    </div>
  );
}

export function AdminDashboardClient() {
  const { t } = useAppLanguage();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [shopName, setShopName] = useState("UMKM Berkah");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [me, transactionRows, debtRows, withdrawalRows] = await Promise.all([api.me(), api.transactions.list(), api.debts.list(), api.withdrawals.list()]);
        setShopName(me.user.shopName || "UMKM Berkah");
        setTransactions(transactionRows);
        setDebts(debtRows);
        setWithdrawals(withdrawalRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat dashboard admin");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySuccess = transactions.filter((row) => new Date(row.createdAt).toDateString() === today && row.status === "success");
    const todaySales = todaySuccess.reduce((sum, row) => sum + row.total, 0);
    const todayProfit = todaySuccess.reduce((sum, row) => sum + (row.grossProfit ?? 0), 0);
    const qrisEarned = transactions.filter((row) => row.paymentMethod === "qris_pakasir" && row.status === "success").reduce((sum, row) => sum + row.total, 0);
    const withdrawn = withdrawals.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.amount, 0);
    const reserved = withdrawals.filter((row) => row.status === "pending" || row.status === "processed").reduce((sum, row) => sum + row.amount, 0);
    const activeDebt = debts.filter((debt) => debt.status !== "paid").reduce((sum, debt) => sum + debt.amount - debt.paidAmount, 0);
    return { todaySales, todayProfit, qrisBalance: Math.max(qrisEarned - withdrawn - reserved, 0), activeDebt };
  }, [debts, transactions, withdrawals]);

  return (
    <div>
      {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mb-4 flex items-center rounded-2xl bg-white p-3 text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat data...")}</p> : null}
      <Card className="overflow-hidden rounded-3xl border-[#d9e3de] bg-white/95 shadow-[0_18px_60px_rgba(11,28,48,0.07)]">
        <CardContent className="space-y-2 p-3 sm:p-4">
          <MetricRow title={t("UMKM Aktif")} value={shopName} helper={t("Cabang yang sedang login")} icon={Store} tone="navy" />
          <MetricRow title={t("Omzet Hari Ini")} value={formatCurrency(stats.todaySales)} helper={t("Tunai + QRIS sukses")} icon={ReceiptText} tone="green" />
          <MetricRow title={t("Laba Kotor Hari Ini")} value={formatCurrency(stats.todayProfit)} helper={t("Omzet - harga modal")} icon={TrendingUp} tone="green" />
          <MetricRow title={t("Saldo Digital")} value={formatCurrency(stats.qrisBalance)} helper={t("QRIS Pakasir sukses - withdraw")} icon={Wallet} tone="blue" />
          <MetricRow title={t("Hutang Aktif")} value={formatCurrency(stats.activeDebt)} helper={t("Belum lunas + sebagian")} icon={NotebookTabs} tone="red" />
        </CardContent>
      </Card>

      <div className="mt-6 grid w-full min-w-0 max-w-full gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="w-full min-w-0 max-w-full bg-[#213145] text-white">
          <CardHeader><CardTitle className="text-white">{t("Aksi Cepat")}</CardTitle><CardDescription className="text-white/70">{t("Operasi harian admin UMKM.")}</CardDescription></CardHeader>
          <CardContent className="grid w-full min-w-0 max-w-full gap-3 px-4 sm:px-6">
            <Link href="/admin/pos" className="block min-w-0">
              <Button size="lg" className="w-full min-w-0 max-w-full justify-start px-4 bg-white text-primary hover:bg-white/90 h-auto min-h-14 gap-3 whitespace-normal break-words text-left leading-tight">
                <Store className="mr-2 h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">{t("Buka Kasir POS")}</span>
              </Button>
            </Link>
            <Link href="/admin/debts" className="block min-w-0">
              <Button size="lg" variant="secondary" className="w-full min-w-0 max-w-full justify-start px-4 h-auto min-h-14 gap-3 whitespace-normal break-words text-left leading-tight">
                <NotebookTabs className="mr-2 h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">{t("Catatan Hutang")}</span>
              </Button>
            </Link>
            <Link href="/admin/withdraw" className="block min-w-0">
              <Button size="lg" className="w-full min-w-0 max-w-full justify-start px-4 bg-white text-[#0f7a4f] hover:bg-white/90 h-auto min-h-14 gap-3 whitespace-normal break-words text-left leading-tight">
                <Wallet className="mr-2 h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">{t("Ajukan Tarik Dana")}</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full bg-white">
          <CardHeader><CardTitle>{t("Transaksi Cabang")}</CardTitle><CardDescription className="break-words">{t("Riwayat singkat transaksi terbaru.")}</CardDescription></CardHeader>
          <CardContent className="w-full max-w-full overflow-x-auto px-4 sm:px-6 [-webkit-overflow-scrolling:touch]">
            <Table className="min-w-[640px]">
              <TableHeader><TableRow><TableHead>{t("Order")}</TableHead><TableHead>{t("Barang")}</TableHead><TableHead>{t("Metode")}</TableHead><TableHead>{t("Total")}</TableHead><TableHead>{t("Status")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {transactions.slice(0, 8).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="max-w-[8rem] truncate whitespace-nowrap font-bold" title={transaction.id}>{shortOrderId(transaction.id)}</TableCell>
                    <TableCell className="max-w-[14rem] truncate" title={transaction.items?.map((item) => `${item.name} x${item.quantity}`).join(", ") || ""}>{transaction.items?.map((item) => `${item.name} x${item.quantity}`).join(", ") || "-"}</TableCell>
                    <TableCell>{t(paymentMethodLabel(transaction.paymentMethod))}</TableCell>
                    <TableCell>{formatCurrency(transaction.total)}</TableCell>
                    <TableCell><Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{t(transactionStatusLabel(transaction.status))}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
