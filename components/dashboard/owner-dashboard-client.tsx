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
import { OwnerMfaCard } from "@/components/dashboard/owner-mfa-card";

function jakartaDate(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

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
    blue: "text-[#0369a1] bg-sky-50 ring-1 ring-sky-100",
    navy: "text-[#1e293b] bg-slate-50 ring-1 ring-slate-100",
  }[tone];
  const valueClass = {
    green: "text-primary",
    blue: "text-[#0875c9]",
    navy: "text-[#0f172a]",
  }[tone];

  return (
    <div className="grid min-w-0 gap-5 rounded-xl border border-[#e2e8f0] bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-6">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon className="h-8 w-8" />
      </div>
      <div className="min-w-0 border-[#dfe7e3] sm:border-l sm:pl-8">
        <p className="text-lg font-black leading-relaxed text-[#0f172a]">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-[#64748b] sm:text-base">{helper}</p>
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
  const [selectedDate, setSelectedDate] = useState(() => jakartaDate());
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
      const response = await fetch(`/api/owner/report?date=${encodeURIComponent(selectedDate)}`, {
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
    const dailyTransactions = transactions.filter((row) => jakartaDate(row.createdAt) === selectedDate);
    const totalRevenue = dailyTransactions
      .filter((row) => row.status === "success")
      .reduce((sum, row) => sum + row.total, 0);
    const grossProfit = dailyTransactions
      .filter((row) => row.status === "success")
      .reduce((sum, row) => sum + (row.grossProfit ?? 0), 0);

    const pendingWithdrawal = withdrawals
      .filter((row) => row.withdrawal.status !== "completed")
      .reduce((sum, row) => sum + row.withdrawal.amount, 0);

    const outstandingDebt = debts
      .filter((row) => row.debt.status !== "paid")
      .reduce((sum, row) => sum + row.debt.amount - row.debt.paidAmount, 0);

    const availableDigital = admins.reduce(
      (sum, row) =>
        sum +
        ((row.balance?.totalEarnedQrisApi ?? 0) -
          (row.balance?.totalWithdrawn ?? 0)),
      0,
    );

    const totalDigital = dailyTransactions
      .filter((row) => row.status === "success" && row.paymentMethod === "qris_pakasir")
      .reduce((sum, row) => sum + row.total, 0);

    return { totalRevenue, grossProfit, pendingWithdrawal, outstandingDebt, totalDigital, availableDigital };
  }, [admins, debts, selectedDate, transactions, withdrawals]);

  const pendingWithdrawals = useMemo(() => withdrawals.filter((row) => row.withdrawal.status !== "completed" && row.withdrawal.status !== "rejected"), [withdrawals]);

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
          <Card className="overflow-hidden border-[#d9e3de] bg-white/95">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-col gap-3 rounded-xl border border-[#dbe6ef] bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-black text-[#0f172a]">Ringkasan Harian</p><p className="text-sm font-semibold text-[#64748b]">Pilih tanggal untuk melihat pendapatan, laba, dan pemasukan QRIS.</p></div>
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || jakartaDate())} className="h-11 rounded-lg border border-[#cbd5e1] bg-white px-3 font-bold text-[#0f172a]" />
              </div>
              <OwnerMetricRow
              title="Total Pendapatan Harian"
              value={formatCurrency(stats.totalRevenue)}
              helper={`Transaksi sukses semua cabang pada ${new Date(`${selectedDate}T12:00:00+07:00`).toLocaleDateString("id-ID", { dateStyle: "long" })}`}
              icon={Wallet}
              tone="green"
            />
              <OwnerMetricRow
              title="Laba Kotor Harian"
              value={formatCurrency(stats.grossProfit)}
              helper="Pendapatan sukses dikurangi modal barang"
              icon={TrendingUp}
              tone="green"
            />
              <OwnerMetricRow
              title="Pemasukan QRIS Digital Harian"
              value={formatCurrency(stats.totalDigital)}
              helper={`Dana masuk tanggal terpilih • saldo tersedia ${formatCurrency(stats.availableDigital)}`}
              icon={Landmark}
              tone="blue"
            />
            </CardContent>
          </Card>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-black text-[#0f172a]">Overview Cabang UMKM</h3>
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
                  <Card key={row.admin.id} className="bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                    <CardContent className="p-6 sm:p-7">
                      <div className="flex items-start gap-5">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1e293b] font-bold text-white">
                          KK
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-black text-[#0f172a]">
                                {row.shop.name}
                              </p>
                              <p className="text-sm font-medium text-[#64748b]">
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

                          <div className="mt-5 grid grid-cols-2 gap-5 border-t border-[#e2e8f0] pt-5">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">
                                Transaksi Hari Ini
                              </p>
                              <p className="text-lg font-extrabold text-primary">
                                {todayTransactions}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Saldo QRIS</p>
                              <p className="text-lg font-extrabold text-[#0f172a]">
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

          <Card className="min-h-[280px] overflow-hidden bg-white">
            <CardContent className="grid gap-6 p-8 md:grid-cols-[1fr_360px] md:items-end">
              <div>
                <Badge variant="blue" className="mb-5">
                  Insight API
                </Badge>
                <h3 className="max-w-lg text-4xl font-black tracking-tight text-[#0f172a]">
                  Selamat Datang, {ownerName}
                </h3>
                <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed text-[#64748b]">
                  Dashboard ini mengambil data admin, transaksi, withdrawal, dan piutang dari API route backend.
                </p>
                <Link
                  href="/owner/withdrawals"
                  className="mt-7 inline-flex items-center gap-2 font-bold text-primary"
                >
                  Review Withdrawal <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
              <div className="flex h-56 items-end gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
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
          <OwnerMfaCard />
          <Card className="bg-white">
            <CardHeader className="border-b border-[#e2e8f0]">
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

              <div className="rounded-xl border border-[#dbe6ef] bg-[#f8fafc] p-3 text-xs font-semibold text-[#64748b]">
                Backup menyimpan semua data utama. Restore akan membuat backup kondisi saat ini dulu sebelum mengganti data.
              </div>

              <div className="space-y-2">
                {backups.slice(0, 3).map((backup) => (
                  <a
                    key={backup.id}
                    href={`/api/owner/backups/${backup.id}`}
                    className="block rounded-xl border border-[#d7e2dc] p-3 text-sm transition hover:border-primary hover:bg-[#f8fafc]"
                  >
                    <span className="block truncate font-bold text-[#0f172a]">{backup.reason === "scheduled-daily" ? "Backup Harian Otomatis" : backup.reason === "owner-manual" ? "Backup Manual Owner" : backup.id}</span>
                    <span className="text-xs font-medium text-[#64748b]">
                      {new Date(backup.createdAt).toLocaleString("id-ID")} • {(backup.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </a>
                ))}
                {backups.length === 0 ? <p className="text-sm font-medium text-[#64748b]">Belum ada backup tersimpan.</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e293b] text-white shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
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
            <CardHeader className="border-b border-[#e2e8f0] pb-4"><CardTitle className="flex items-center justify-between gap-3"><span>Permintaan Tarik Dana</span>{pendingWithdrawals.length ? <Badge variant="danger">{pendingWithdrawals.length}</Badge> : <Badge variant="secondary">0</Badge>}</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-5">
              {pendingWithdrawals.slice(0, 3).map((row) => <div key={row.withdrawal.id} className="rounded-xl border border-[#dbe6ef] bg-[#f8fafc] p-4"><p className="truncate font-black text-[#0f172a]">{row.admin.shopName || row.admin.name}</p><p className="mt-1 text-xs font-semibold text-[#64748b]">Admin: {row.admin.name}</p><div className="mt-3 flex items-center justify-between gap-3"><p className="font-black text-primary">{formatCurrency(row.withdrawal.amount)}</p><Link href="/owner/withdrawals"><Button size="sm">Review</Button></Link></div></div>)}
              {pendingWithdrawals.length === 0 ? <div className="rounded-xl border border-dashed border-[#cbd5e1] p-5 text-center"><p className="font-bold text-[#475569]">Tidak ada permintaan aktif</p><p className="mt-1 text-xs text-[#64748b]">Antrian penarikan baru akan muncul di sini.</p></div> : null}
              <Link href="/owner/withdrawals" className="flex items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary">Lihat semua antrian <ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-white"><CardHeader className="border-b border-[#e2e8f0] pb-4"><CardTitle className="flex items-center gap-2"><NotebookTabs className="h-5 w-5 text-primary" />Piutang Aktif</CardTitle></CardHeader><CardContent className="p-5"><div className="rounded-xl border border-[#dbe6ef] bg-[#f8fafc] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748b]">Total belum dibayar</p><p className="mt-2 break-words text-3xl font-black text-[#0f172a]">{formatCurrency(stats.outstandingDebt)}</p></div><Link href="/owner/debts" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary">Review catatan hutang <ArrowRight className="h-4 w-4" /></Link></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
