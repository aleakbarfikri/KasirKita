"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, NotebookTabs, ReceiptText, Store, Wallet } from "lucide-react";
import { api, debtStatusLabel, paymentMethodLabel, transactionStatusLabel, type DebtRecord, type TransactionRecord, type WithdrawalRecord } from "@/lib/api-client";
import { MetricCard } from "@/components/layout/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

function statusVariant(status: TransactionRecord["status"]) {
  if (status === "success") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "cancelled") return "secondary" as const;
  return "danger" as const;
}

export function AdminDashboardClient() {
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
    const todaySales = transactions.filter((row) => new Date(row.createdAt).toDateString() === today && row.status === "success").reduce((sum, row) => sum + row.total, 0);
    const qrisEarned = transactions.filter((row) => row.paymentMethod === "qris_pakasir" && row.status === "success").reduce((sum, row) => sum + row.total, 0);
    const withdrawn = withdrawals.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.amount, 0);
    const reserved = withdrawals.filter((row) => row.status === "pending" || row.status === "processed").reduce((sum, row) => sum + row.amount, 0);
    const activeDebt = debts.filter((debt) => debt.status !== "paid").reduce((sum, debt) => sum + debt.amount - debt.paidAmount, 0);
    return { todaySales, qrisBalance: Math.max(qrisEarned - withdrawn - reserved, 0), activeDebt };
  }, [debts, transactions, withdrawals]);

  return (
    <div>
      {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mb-4 flex items-center rounded-2xl bg-white p-3 text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat data dari API...</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="UMKM Aktif" value={shopName} helper="Cabang yang sedang login" icon={Store} tone="navy" />
        <MetricCard title="Omzet Hari Ini" value={formatCurrency(stats.todaySales)} helper="Tunai + QRIS sukses" icon={ReceiptText} tone="green" />
        <MetricCard title="Saldo Digital" value={formatCurrency(stats.qrisBalance)} helper="QRIS Pakasir sukses - withdrawal" icon={Wallet} tone="blue" />
        <MetricCard title="Hutang Aktif" value={formatCurrency(stats.activeDebt)} helper="Belum lunas + sebagian" icon={NotebookTabs} tone="red" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="bg-[#213145] text-white">
          <CardHeader><CardTitle className="text-white">Aksi Cepat</CardTitle><CardDescription className="text-white/70">Operasi harian admin UMKM.</CardDescription></CardHeader>
          <CardContent className="grid min-w-0 gap-3">
            <Link href="/admin/pos" className="block min-w-0">
              <Button size="lg" className="w-full min-w-0 justify-start px-4 bg-white text-primary hover:bg-white/90">
                <Store className="mr-2 h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">Buka Kasir POS</span>
              </Button>
            </Link>
            <Link href="/admin/debts" className="block min-w-0">
              <Button size="lg" variant="secondary" className="w-full min-w-0 justify-start px-4">
                <NotebookTabs className="mr-2 h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">Catatan Hutang</span>
              </Button>
            </Link>
            <Link href="/admin/withdraw" className="block min-w-0">
              <Button size="lg" className="w-full min-w-0 justify-start px-4 bg-white text-[#0f7a4f] hover:bg-white/90">
                <Wallet className="mr-2 h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">Ajukan Tarik Dana</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader><CardTitle>Transaksi Cabang</CardTitle><CardDescription>Riwayat singkat transaksi dari endpoint <code>/api/transactions</code>.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Metode</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {transactions.slice(0, 8).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-bold">{transaction.id}</TableCell>
                    <TableCell>{paymentMethodLabel(transaction.paymentMethod)}</TableCell>
                    <TableCell>{formatCurrency(transaction.total)}</TableCell>
                    <TableCell><Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{transactionStatusLabel(transaction.status)}</Badge></TableCell>
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
