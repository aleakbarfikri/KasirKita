"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Archive,
  DatabaseBackup,
  Download,
  Landmark,
  Loader2,
  NotebookTabs,
  TrendingUp,
  UploadCloud,
  Users,
  Wallet,
} from "lucide-react";

import {
  api,
  type BackupInfo,
  type OwnerAdminRow,
  type OwnerDebtRow,
  type OwnerWithdrawalRow,
  type TransactionRecord,
} from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

function OwnerMetricRow({
  title,
  value,
  helper,
  icon: Icon,
  tone = "green",
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof Wallet;
  tone?: "green" | "blue" | "navy";
}) {
  const toneClass = {
    green: "text-primary bg-primary/10",
    blue: "text-[#00628d] bg-[#c9e6ff]",
    navy: "text-[#213145] bg-[#dae2fd]",
  }[tone];
  const valueClass = {
    green: "text-primary",
    blue: "text-[#0875c9]",
    navy: "text-[#0b1c30]",
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

export function OwnerDashboardClient() {
  const [admins, setAdmins] = useState<OwnerAdminRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<OwnerWithdrawalRow[]>([]);
  const [debts, setDebts] = useState<OwnerDebtRow[]>([]);
  const [ownerName, setOwnerName] = useState("Owner");
  const [loading, setLoading] = useState(true);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const [me, adminRows, transactionRows, withdrawalRows, debtRows, backupRows] =
        await Promise.all([
          api.me(),
          api.owner.admins.list(),
          api.transactions.list(),
          api.owner.withdrawals.list(),
          api.owner.debts.list(),
          api.owner.backups.list().catch(() => []),
        ]);

      setOwnerName(me.user.name || "Owner");
      setAdmins(adminRows);
      setTransactions(transactionRows);
      setWithdrawals(withdrawalRows);
      setDebts(debtRows);
      setBackups(backupRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat dashboard owner");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function downloadReport() {
    setReportDownloading(true);
    setError(null);

    try {
      const response = await fetch("/api/owner/report", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        let message = "Gagal mengunduh laporan";

        try {
          const payload = await response.json();
          message = payload?.error?.message || message;
        } catch {
          // Keep default message for non-JSON error responses.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename =
        match?.[1] ||
        `kasirkita-owner-report-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh laporan");
    } finally {
      setReportDownloading(false);
    }
  }

  async function createBackup() {
    setBackupBusy(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const backup = await api.owner.backups.create();
      setBackups((current) => [backup, ...current.filter((row) => row.id !== backup.id)]);
      setSuccessMessage("Backup berhasil dibuat. Klik nama backup untuk download file JSON.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat backup");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup(file: File) {
    const confirmed = window.confirm(
      "Restore backup akan mengganti data KasirKita saat ini dengan isi file JSON. Sistem akan membuat backup kondisi sekarang dulu sebelum restore. Lanjutkan?",
    );
    if (!confirmed) return;

    setRestoreBusy(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await api.owner.backups.restore(file);
      await loadDashboard();
      setSuccessMessage(
        `Restore berhasil. Data berisi ${result.counts.users} user, ${result.counts.products} produk, ${result.counts.transactions} transaksi, dan ${result.counts.debts} hutang. Backup kondisi sebelum restore: ${result.backupBeforeRestore.id}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal restore backup");
    } finally {
      setRestoreBusy(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  }

  const stats = useMemo(() => {
    const totalRevenue = transactions
      .filter((row) => row.status === "success")
      .reduce((sum, row) => sum + row.total, 0);
    const grossProfit = transactions
      .filter((row) => row.status === "success")
      .reduce((sum, row) => sum + (row.grossProfit ?? 0), 0);

    const pendingWithdrawal = withdrawals
      .filter((row) => row.withdrawal.status !== "completed")
      .reduce((sum, row) => sum + row.withdrawal.amount, 0);

    const outstandingDebt = debts
      .filter((row) => row.debt.status !== "paid")
      .reduce((sum, row) => sum + row.debt.amount - row.debt.paidAmount, 0);

    const totalDigital = admins.reduce(
      (sum, row) =>
        sum +
        ((row.balance?.totalEarnedQrisApi ?? 0) -
          (row.balance?.totalWithdrawn ?? 0)),
      0,
    );

    return { totalRevenue, grossProfit, pendingWithdrawal, outstandingDebt, totalDigital };
  }, [admins, debts, transactions, withdrawals]);

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mb-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="mb-4 flex items-center rounded-2xl bg-white p-3 text-sm text-[#3d4a42]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Memuat data dari API...
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <Card className="overflow-hidden rounded-3xl border-[#d9e3de] bg-white/95 shadow-[0_18px_60px_rgba(11,28,48,0.07)]">
            <CardContent className="space-y-2 p-3 sm:p-4">
              <OwnerMetricRow
              title="Total Pendapatan"
              value={formatCurrency(stats.totalRevenue)}
              helper="Dari transaksi sukses semua cabang"
              icon={Wallet}
              tone="green"
            />
              <OwnerMetricRow
              title="Laba Kotor"
              value={formatCurrency(stats.grossProfit)}
              helper="Pendapatan sukses dikurangi modal barang"
              icon={TrendingUp}
              tone="green"
            />
              <OwnerMetricRow
              title="Saldo QRIS Digital"
              value={formatCurrency(stats.totalDigital)}
              helper="Akumulasi QRIS Pakasir tersedia"
              icon={Landmark}
              tone="blue"
            />
            </CardContent>
          </Card>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Overview Cabang UMKM</h3>
              <Link href="/owner/admins" className="text-sm font-bold text-primary">
                Lihat Semua
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {admins.slice(0, 4).map((row) => {
                const todayTransactions = transactions.filter(
                  (transaction) =>
                    transaction.shopName === row.shop.name &&
                    new Date(transaction.createdAt).toDateString() ===
                      new Date().toDateString(),
                ).length;

                return (
                  <Card key={row.admin.id} className="bg-white">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#213145] font-bold text-white">
                          KK
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-extrabold">
                                {row.shop.name}
                              </p>
                              <p className="text-sm text-[#3d4a42]">
                                {row.shop.address || row.admin.name}
                              </p>
                            </div>
                            <Badge
                              variant={row.profile.isActive ? "success" : "secondary"}
                              className="normal-case tracking-normal"
                            >
                              {row.profile.isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 border-t border-[#bccac0] pt-4">
                            <div>
                              <p className="text-xs text-[#3d4a42]">
                                Transaksi Hari Ini
                              </p>
                              <p className="text-lg font-extrabold text-primary">
                                {todayTransactions}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[#3d4a42]">Saldo QRIS</p>
                              <p className="text-lg font-extrabold">
                                {formatCurrency(
                                  Math.max(
                                    (row.balance?.totalEarnedQrisApi ?? 0) -
                                      (row.balance?.totalWithdrawn ?? 0),
                                    0,
                                  ),
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <Card className="min-h-[280px] bg-white">
            <CardContent className="grid gap-6 p-8 md:grid-cols-[1fr_360px] md:items-end">
              <div>
                <Badge variant="blue" className="mb-5">
                  Insight API
                </Badge>
                <h3 className="max-w-lg text-4xl font-extrabold tracking-tight">
                  Selamat Datang, {ownerName}
                </h3>
                <p className="mt-5 max-w-xl text-lg text-[#3d4a42]">
                  Dashboard ini mengambil data admin, transaksi, withdrawal, dan piutang dari API route backend.
                </p>
                <Link
                  href="/owner/withdrawals"
                  className="mt-7 inline-flex items-center gap-2 font-bold text-primary"
                >
                  Review Withdrawal <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
              <div className="flex h-56 items-end gap-4">
                {[36, 64, 47, 78, 70, 90].map((height, index) => (
                  <div
                    key={index}
                    className={`flex-1 rounded-t-xl ${
                      index % 3 === 2 ? "bg-[#00628d]" : "bg-primary"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="bg-white">
            <CardHeader className="border-b border-[#bccac0]">
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                Backup & Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <Button className="w-full" onClick={downloadReport} disabled={reportDownloading || loading}>
                {reportDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export CSV
              </Button>
              <Button className="w-full" variant="outline" onClick={createBackup} disabled={backupBusy || loading}>
                {backupBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
                Buat Backup JSON
              </Button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void restoreBackup(file);
                }}
              />
              <Button
                className="w-full"
                variant="outline"
                onClick={() => restoreInputRef.current?.click()}
                disabled={restoreBusy || backupBusy || loading}
              >
                {restoreBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                Restore Backup JSON
              </Button>

              <div className="rounded-xl bg-[#eff4ff] p-3 text-xs font-semibold text-[#3d4a42]">
                Backup menyimpan semua data utama. Restore akan membuat backup kondisi saat ini dulu sebelum mengganti data.
              </div>

              <div className="space-y-2">
                {backups.slice(0, 3).map((backup) => (
                  <a
                    key={backup.id}
                    href={`/api/owner/backups/${backup.id}`}
                    className="block rounded-xl border border-[#bccac0] p-3 text-sm hover:bg-[#f8f9ff]"
                  >
                    <span className="block truncate font-bold text-[#0b1c30]">{backup.id}</span>
                    <span className="text-xs text-[#3d4a42]">
                      {new Date(backup.createdAt).toLocaleString("id-ID")} • {(backup.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </a>
                ))}
                {backups.length === 0 ? <p className="text-sm text-[#3d4a42]">Belum ada backup tersimpan.</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#213145] text-white">
            <CardHeader>
              <CardTitle className="text-white">Akses Cepat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/owner/admins"
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
              >
                <Users className="h-5 w-5 text-emerald-200" /> Kelola Admin
              </Link>
              <Link
                href="/owner/payments"
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
              >
                <Landmark className="h-5 w-5 text-emerald-200" /> Konfigurasi API
              </Link>
              <Link
                href="/owner/debts"
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
              >
                <NotebookTabs className="h-5 w-5 text-emerald-200" /> Piutang Cabang
              </Link>
              <p className="pt-2 text-sm italic text-white/70">
                Frontend terhubung ke API backend.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-white">
            <CardHeader className="flex-row items-center justify-between border-b border-[#bccac0]">
              <CardTitle>Permintaan Tarik Dana</CardTitle>
              <span className="h-2 w-2 rounded-full bg-red-600" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_100px_70px] bg-[#eff4ff] px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-[#3d4a42]">
                <span>Admin</span>
                <span>Jumlah</span>
                <span>Aksi</span>
              </div>
              {withdrawals.slice(0, 5).map((row) => (
                <div
                  key={row.withdrawal.id}
                  className="grid grid-cols-[1fr_100px_70px] items-center border-t border-[#bccac0] px-6 py-4"
                >
                  <div>
                    <p className="font-extrabold leading-tight">
                      {row.admin.shopName || row.admin.name}
                    </p>
                    <p className="text-xs text-[#3d4a42]">
                      Admin: {row.admin.name}
                    </p>
                  </div>
                  <p className="font-extrabold text-primary">
                    {formatCurrency(row.withdrawal.amount)}
                  </p>
                  <Link href="/owner/withdrawals">
                    <Button size="sm">Buka</Button>
                  </Link>
                </div>
              ))}
              <Link
                href="/owner/withdrawals"
                className="block bg-[#eff4ff] px-6 py-4 text-center text-sm font-bold italic text-primary"
              >
                Lihat semua antrian ({withdrawals.length})
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#3d4a42]">Piutang Aktif</p>
                  <p className="mt-2 text-3xl font-extrabold text-[#0b1c30]">
                    {formatCurrency(stats.outstandingDebt)}
                  </p>
                </div>
                <NotebookTabs className="h-10 w-10 text-primary" />
              </div>
              <Link
                href="/owner/debts"
                className="mt-4 inline-flex items-center gap-2 font-bold text-primary"
              >
                Review catatan hutang <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
