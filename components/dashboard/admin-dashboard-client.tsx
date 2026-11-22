"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, CalendarDays, Loader2, NotebookTabs, Package, QrCode, ReceiptText, Store, TrendingUp, Wallet } from "lucide-react";
import { api, debtStatusLabel, paymentMethodLabel, transactionStatusLabel, type AdminProfile, type DebtRecord, type SubscriptionInvoiceRecord, type TransactionRecord, type WithdrawalRecord } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useAppLanguage } from "@/lib/i18n";
import { OwnerMfaCard } from "@/components/dashboard/owner-mfa-card";
import { jakartaDateKey, shiftDateKey } from "@/lib/report-dates";
import { dateRangeTransactionSummary } from "@/lib/report-summary";

type SubscriptionPlanChoice = "trial" | "basic" | "starter" | "pro" | "business";
type PaidSubscriptionPlanChoice = Exclude<SubscriptionPlanChoice, "trial">;

function isSubscriptionPlanChoice(value?: string | null): value is SubscriptionPlanChoice {
  return value === "trial" || value === "basic" || value === "starter" || value === "pro" || value === "business";
}

function isPaidSubscriptionPlanChoice(value?: string | null): value is PaidSubscriptionPlanChoice {
  return value === "basic" || value === "starter" || value === "pro" || value === "business";
}

function dateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDaysInput(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

const defaultBillingPeriod: Record<PaidSubscriptionPlanChoice, "monthly" | "yearly"> = {
  basic: "yearly",
  starter: "monthly",
  pro: "monthly",
  business: "monthly",
};

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
    <div className="grid min-w-0 gap-4 rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon className="h-8 w-8" />
      </div>
      <div className="min-w-0 border-[#dfe7e3] sm:border-l sm:pl-7">
        <p className="text-lg font-black leading-tight text-[#0f172a]">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-[#64748b] sm:text-base">{helper}</p>
      </div>
      <p className={`min-w-0 break-words text-left text-3xl font-black tracking-normal sm:whitespace-nowrap sm:text-right sm:text-4xl ${valueClass}`}>{value}</p>
    </div>
  );
}

function StitchStatCard({
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
    green: "bg-[#006948]/10 text-primary",
    blue: "bg-[#c9e6ff] text-[#00628d]",
    navy: "bg-[#f2f3ff] text-[#151b2d]",
    red: "bg-red-50 text-red-700",
  }[tone];

  return (
    <div className="kk-stitch-card min-h-[168px] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(21,27,45,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#505f76]">{title}</p>
          <p className="mt-4 break-all text-3xl font-black tracking-normal text-[#151b2d]">{value}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold leading-relaxed text-[#505f76]">{helper}</p>
    </div>
  );
}

export function AdminDashboardClient() {
  const { t } = useAppLanguage();
  const searchParams = useSearchParams();
  const checkoutPlan = searchParams.get("checkoutPlan");
  const checkoutBillingPeriod = searchParams.get("billingPeriod") === "monthly" ? "monthly" : "yearly";
  const autoCheckoutStarted = useRef(false);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [accountRole, setAccountRole] = useState<"admin" | "cashier" | null>(null);
  const [subscriptionInvoices, setSubscriptionInvoices] = useState<SubscriptionInvoiceRecord[]>([]);
  const [invoice, setInvoice] = useState<SubscriptionInvoiceRecord | null>(null);
  const [shopName, setShopName] = useState("UMKM Berkah");
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanChoice>("pro");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
  const [summaryStart, setSummaryStart] = useState(() => jakartaDateKey(new Date()));
  const [summaryEnd, setSummaryEnd] = useState(() => jakartaDateKey(new Date()));
  const [reportStart, setReportStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 6); return dateInputValue(date); });
  const [reportEnd, setReportEnd] = useState(() => dateInputValue(new Date()));
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(searchParams.get("subscription") === "1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubscriptionModalOpen(searchParams.get("subscription") === "1");
  }, [searchParams]);

  useEffect(() => {
    const openSubscription = () => setSubscriptionModalOpen(true);
    window.addEventListener("kasirkita:open-subscription", openSubscription);
    return () => window.removeEventListener("kasirkita:open-subscription", openSubscription);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [me, transactionRows, debtRows, withdrawalRows, invoiceRows] = await Promise.all([api.me(), api.transactions.list(), api.debts.list(), api.withdrawals.list(), api.subscription.listInvoices().catch(() => [])]);
        setShopName(me.user.shopName || "UMKM Berkah");
        setAccountRole(me.user.role === "cashier" ? "cashier" : "admin");
        setAdminProfile(me.adminProfile ?? null);
        setSelectedPlan(isPaidSubscriptionPlanChoice(checkoutPlan) ? checkoutPlan : isSubscriptionPlanChoice(me.adminProfile?.planType) && me.adminProfile?.planType !== "trial" ? me.adminProfile.planType : "pro");
        if (isPaidSubscriptionPlanChoice(checkoutPlan)) setBillingPeriod(checkoutBillingPeriod);
        setTransactions(transactionRows);
        setDebts(debtRows);
        setWithdrawals(withdrawalRows);
        setSubscriptionInvoices(invoiceRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat dashboard admin");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [checkoutBillingPeriod, checkoutPlan]);

  async function createSubscriptionInvoice(planType: "basic" | "starter" | "pro" | "business", billingPeriod: "monthly" | "yearly") {
    setSubscriptionLoading(true);
    setError(null);
    try {
      const result = await api.subscription.checkout({ planType, billingPeriod });
      setInvoice(result.invoice);
      setSubscriptionInvoices((current) => [result.invoice, ...current.filter((row) => row.id !== result.invoice.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat pembayaran subscription");
    } finally {
      setSubscriptionLoading(false);
    }
  }

  useEffect(() => {
    if (loading || autoCheckoutStarted.current || !isPaidSubscriptionPlanChoice(checkoutPlan)) return;
    autoCheckoutStarted.current = true;
    setSelectedPlan(checkoutPlan);
    createSubscriptionInvoice(checkoutPlan, checkoutBillingPeriod || defaultBillingPeriod[checkoutPlan]);
  }, [checkoutBillingPeriod, checkoutPlan, loading]);

  async function checkSubscriptionPayment() {
    if (!invoice) return;
    setSubscriptionLoading(true);
    try {
      const result = await api.subscription.poll(invoice.id);
      setInvoice(result.invoice);
      if (result.profile) setAdminProfile(result.profile);
      setSubscriptionInvoices((current) => current.map((row) => row.id === result.invoice.id ? result.invoice : row));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal cek pembayaran subscription");
    } finally {
      setSubscriptionLoading(false);
    }
  }

  const stats = useMemo(() => {
    const summary = dateRangeTransactionSummary(transactions, summaryStart, summaryEnd);
    const qrisEarned = transactions.filter((row) => row.paymentMethod === "qris_pakasir" && row.status === "success").reduce((sum, row) => sum + row.total, 0);
    const withdrawn = withdrawals.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.amount, 0);
    const reserved = withdrawals.filter((row) => row.status === "pending" || row.status === "processed").reduce((sum, row) => sum + row.amount, 0);
    const activeDebt = debts.filter((debt) => debt.status !== "paid").reduce((sum, debt) => sum + debt.amount - debt.paidAmount, 0);
    return { summary, qrisBalance: Math.max(qrisEarned - withdrawn - reserved, 0), activeDebt };
  }, [debts, summaryEnd, summaryStart, transactions, withdrawals]);

  const recentTransactions = useMemo(() => transactions.filter((transaction) => {
    const date = jakartaDateKey(transaction.createdAt);
    return date >= summaryStart && date <= summaryEnd;
  }).slice(0, 8), [summaryEnd, summaryStart, transactions]);

  const reportTransactions = useMemo(() => {
    const start = new Date(`${reportStart}T00:00:00`);
    const end = new Date(`${reportEnd}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
    return transactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt).getTime();
      return createdAt >= start.getTime() && createdAt <= end.getTime();
    });
  }, [reportEnd, reportStart, transactions]);

  const weeklySales = useMemo(() => {
    const start = new Date(`${reportStart}T00:00:00`);
    const end = new Date(`${reportEnd}T00:00:00`);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return {
        key: date.toDateString(),
        label: date.toLocaleDateString("id-ID", { weekday: "short" }),
        value: 0,
      };
    });

    reportTransactions.forEach((transaction) => {
      if (transaction.status !== "success") return;
      const found = days.find((day) => day.key === new Date(transaction.createdAt).toDateString());
      if (found) found.value += transaction.total;
    });

    const max = Math.max(...days.map((day) => day.value), 1);
    return days.map((day) => ({ ...day, height: Math.max(8, Math.round((day.value / max) * 100)) }));
  }, [reportEnd, reportStart, reportTransactions]);

  const topProducts = useMemo(() => {
    const totals = new Map<string, number>();
    reportTransactions.filter((row) => row.status === "success").forEach((row) => {
      row.items?.forEach((item) => totals.set(item.name, (totals.get(item.name) || 0) + item.quantity));
    });
    const rows = Array.from(totals, ([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    const max = Math.max(...rows.map((row) => row.quantity), 1);
    return rows.slice(0, 10).map((row) => ({ ...row, height: Math.max(8, Math.round((row.quantity / max) * 100)) }));
  }, [reportTransactions]);

  const planDetails = [
    {
      id: "trial" as const,
      name: "Free",
      price: t("Gratis selamanya"),
      billingPeriod: null,
      note: t("Cocok untuk coba POS dasar sebelum berlangganan."),
      features: [t("50 produk"), t("1 kasir"), t("500 transaksi/bulan"), t("POS kasir"), t("QRIS KasirKita"), t("Scan barcode SKU"), t("Struk dengan watermark KasirKita")],
    },
    {
      id: "basic" as const,
      name: "Basic",
      price: t("Rp100.000 / tahun"),
      billingPeriod: "yearly" as const,
      note: t("Paket hemat untuk toko kecil dengan transaksi sederhana."),
      features: [t("300 produk"), t("1 kasir"), t("500 transaksi/bulan"), t("POS kasir"), t("Inventaris produk"), t("Diskon aktif"), t("Struk thermal dasar"), t("QRIS statis manual"), t("Riwayat transaksi"), t("Tanpa QRIS KasirKita"), t("Tanpa shift kasir")],
    },
    {
      id: "starter" as const,
      name: "Starter",
      price: t("Rp19.000 / bulan"),
      billingPeriod: "monthly" as const,
      note: t("Untuk UMKM kecil yang butuh POS lebih lega dengan diskon aktif."),
      features: [t("500 produk"), t("1 kasir"), t("1.000 transaksi/bulan"), t("POS kasir"), t("Inventaris produk"), t("Diskon aktif"), t("QRIS statis manual"), t("Struk thermal 58/80mm"), t("Riwayat transaksi"), t("Laporan sederhana"), t("Tanpa QRIS KasirKita")],
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: t("Rp39.000 / bulan"),
      billingPeriod: "yearly" as const,
      note: t("Untuk UMKM yang mulai butuh kontrol stok dan pembayaran lebih lengkap."),
      features: [t("5.000 produk"), t("5 kasir"), t("10.000 transaksi/bulan"), t("Semua fitur Free"), t("Import/export CSV"), t("Hutang dan shift kasir"), t("Laporan omzet dan laba"), t("Backup dan restore")],
    },
    {
      id: "business" as const,
      name: "Business",
      price: t("Rp99.000 / bulan"),
      billingPeriod: "yearly" as const,
      note: t("Untuk toko yang butuh kapasitas besar tanpa batas utama."),
      features: [t("Produk unlimited"), t("Kasir unlimited"), t("Transaksi unlimited"), t("Maksimal 5 cabang"), t("Semua fitur Pro"), t("Backup otomatis"), t("Dashboard lintas cabang"), t("Prioritas support")],
    },
  ];
  const commercialPlanDetails = planDetails.filter((plan) => plan.id === "trial" || plan.id === "pro" || plan.id === "business");
  const selectedPlanDetail = commercialPlanDetails.find((plan) => plan.id === selectedPlan) ?? commercialPlanDetails[1];
  const selectedPlanPrice = selectedPlanDetail.id === "pro"
    ? billingPeriod === "monthly" ? "Rp49.000 / bulan" : "Rp39.000 / bulan"
    : selectedPlanDetail.id === "business"
      ? billingPeriod === "monthly" ? "Rp129.000 / bulan" : "Rp99.000 / bulan"
      : selectedPlanDetail.price;
  const subscriptionReminder = useMemo(() => {
    if (!adminProfile?.activeUntil) return null;
    const today = new Date();
    const activeUntil = new Date(`${adminProfile.activeUntil}T00:00:00+07:00`);
    const daysLeft = Math.ceil((activeUntil.getTime() - today.getTime()) / 86_400_000);
    if (daysLeft < 0) return { tone: "danger", title: t("Subscription sudah expired"), description: t("Perpanjang paket agar admin dan kasir bisa aktif kembali.") };
    if (daysLeft <= 1) return { tone: "danger", title: t("Subscription berakhir hari ini"), description: t("Segera perpanjang agar operasional tidak berhenti.") };
    if (daysLeft <= 3) return { tone: "warning", title: `${t("Subscription tersisa")} ${daysLeft} ${t("hari")}`, description: t("Sebaiknya perpanjang sekarang sebelum akses admin/kasir terkunci.") };
    if (daysLeft <= 7) return { tone: "warning", title: `${t("Subscription tersisa")} ${daysLeft} ${t("hari")}`, description: t("Siapkan perpanjangan paket agar toko tetap berjalan lancar.") };
    return null;
  }, [adminProfile?.activeUntil, t]);

  return (
    <div>
      {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mb-4 flex items-center rounded-2xl bg-white p-3 text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat data...")}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#bec9c1] bg-white p-3 sm:p-4">
        <div className="mr-auto"><p className="font-black text-[#151b2d]">{t("Ringkasan Penjualan")}</p><p className="text-sm font-semibold text-[#505f76]">{t("Pilih tanggal mulai dan sampai untuk melihat total omzet, transaksi, modal, dan laba.")}</p></div>
        <label className="text-xs font-bold text-[#505f76]">{t("Mulai")}<input type="date" value={summaryStart} max={summaryEnd} onChange={(event) => { if (event.target.value) setSummaryStart(event.target.value); }} className="mt-1 block h-10 rounded-lg border border-[#bec9c1] bg-white px-3 text-sm font-bold text-[#151b2d]" /></label>
        <label className="text-xs font-bold text-[#505f76]">{t("Sampai")}<input type="date" value={summaryEnd} min={summaryStart} max={jakartaDateKey(new Date())} onChange={(event) => { if (event.target.value) setSummaryEnd(event.target.value); }} className="mt-1 block h-10 rounded-lg border border-[#bec9c1] bg-white px-3 text-sm font-bold text-[#151b2d]" /></label>
        <Button variant="outline" size="sm" onClick={() => { const yesterday = shiftDateKey(jakartaDateKey(new Date()), -1); setSummaryStart(yesterday); setSummaryEnd(yesterday); }}>{t("Kemarin")}</Button>
        <Button variant="outline" size="sm" onClick={() => { const today = jakartaDateKey(new Date()); setSummaryStart(today); setSummaryEnd(today); }}>{t("Hari ini")}</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StitchStatCard title={t("Omzet")} value={formatCurrency(stats.summary.sales)} helper={t("Total transaksi sukses dalam periode dipilih")} icon={ReceiptText} tone="green" />
        <StitchStatCard title={t("Transaksi")} value={`${stats.summary.count}`} helper={t("Transaksi sukses dalam periode dipilih")} icon={BarChart3} tone="navy" />
        <StitchStatCard title={t("Harga Modal")} value={formatCurrency(stats.summary.cost)} helper={t("Total modal barang terjual dalam periode dipilih")} icon={Package} tone="navy" />
        <StitchStatCard title={t("Laba Kotor")} value={formatCurrency(stats.summary.profit)} helper={t("Omzet dikurangi modal barang dalam periode dipilih")} icon={TrendingUp} tone="green" />
        <StitchStatCard title={t("Saldo Digital")} value={formatCurrency(stats.qrisBalance)} helper={t("Saldo saat ini dari seluruh tanggal")} icon={Wallet} tone="blue" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <Card className="kk-stitch-card w-full min-w-0 overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl text-[#151b2d]">{t("Riwayat Penjualan")}</CardTitle>
              <CardDescription className="font-semibold text-[#505f76]">{t("Grafik transaksi sukses sesuai periode yang dipilih.")}</CardDescription>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-black text-[#505f76]">{t("Mulai")}<input type="date" value={reportStart} max={reportEnd} onChange={(event) => { const start = event.target.value; setReportStart(start); setReportEnd(addDaysInput(start, 6)); }} className="mt-1 block h-9 rounded-lg border border-[#bec9c1] bg-white px-2 text-xs font-bold text-[#151b2d]" /></label>
              <label className="text-xs font-black text-[#505f76]">{t("Sampai")}<input type="date" value={reportEnd} min={reportStart} max={addDaysInput(reportStart, 6)} onChange={(event) => setReportEnd(event.target.value)} className="mt-1 block h-9 rounded-lg border border-[#bec9c1] bg-white px-2 text-xs font-bold text-[#151b2d]" /></label>
              <Badge variant="secondary" className="mb-1 w-fit">{shopName}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-72 items-end gap-3 rounded-xl border border-[#bec9c1] bg-[#f8fafc] p-4">
              {weeklySales.map((day) => (
                <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                  <div className="relative flex flex-1 items-end rounded-t-xl bg-white">
                    <div className="w-full rounded-t-xl bg-primary/80 transition-all" style={{ height: `${day.height}%` }} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase text-[#505f76]">{day.label}</p>
                    <p className="truncate text-[11px] font-bold text-primary">{formatCurrency(day.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="kk-stitch-card">
          <CardHeader>
            <CardTitle className="text-2xl text-[#151b2d]">{t("Aksi Cepat")}</CardTitle>
            <CardDescription className="font-semibold text-[#505f76]">{t("Operasi harian admin UMKM.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid w-full min-w-0 gap-3 px-4 sm:px-6">
            {[
              { href: "/admin/pos", label: t("Buka Kasir POS"), icon: Store },
              { href: "/admin/inventory", label: t("Kelola Inventaris"), icon: Package },
              { href: "/admin/debts", label: t("Catatan Hutang"), icon: NotebookTabs },
              { href: "/admin/withdraw", label: t("Ajukan Tarik Dana"), icon: Wallet },
            ].map((action) => (
              <Link key={action.href} href={action.href} className="group flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[#bec9c1] bg-white px-3 py-3 transition hover:border-primary hover:bg-[#006948]/5 sm:px-4">
                <span className="flex min-w-0 items-center gap-3 font-black text-[#151b2d]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#006948]/10 text-primary">
                    <action.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 break-words leading-tight">{action.label}</span>
                </span>
                <span className="text-lg font-black text-primary transition group-hover:translate-x-0.5">→</span>
              </Link>
            ))}
            <div className="mt-2 rounded-xl border border-[#bec9c1] bg-[#f8fafc] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#505f76]">{t("Hutang Aktif")}</p>
              <p className="mt-2 text-2xl font-black text-[#151b2d]">{formatCurrency(stats.activeDebt)}</p>
              <p className="mt-1 text-sm font-semibold text-[#505f76]">{t("Belum lunas + sebagian")}</p>
            </div>
          </CardContent>
        </Card>

      </div>

      <Card className="mt-6 kk-stitch-card">
        <CardHeader><CardTitle className="text-2xl text-[#151b2d]">{t("Barang Terlaris")}</CardTitle><CardDescription className="font-semibold text-[#505f76]">{t("Produk dengan jumlah terjual terbanyak pada periode yang dipilih.")}</CardDescription></CardHeader>
        <CardContent>
          {topProducts.length === 0 ? <p className="rounded-xl bg-[#f8fafc] p-6 text-center text-sm font-semibold text-[#64748b]">{t("Belum ada data penjualan.")}</p> : <div className="flex h-56 items-end gap-3 rounded-xl border border-[#bec9c1] bg-[#f8fafc] p-4">{topProducts.map((row) => <div key={row.name} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="relative flex flex-1 items-end rounded-t-xl bg-white"><div className="w-full rounded-t-xl bg-primary/80" style={{ height: `${row.height}%` }} /></div><p className="truncate text-center text-xs font-black text-[#505f76]" title={row.name}>{row.name}</p><p className="text-center text-[11px] font-bold text-primary">{row.quantity} {t("terjual")}</p></div>)}</div>}
        </CardContent>
      </Card>

      <div className="mt-6 grid w-full min-w-0 max-w-full gap-6">
        {accountRole === "admin" ? <OwnerMfaCard roleLabel="Admin" /> : null}
        <Modal open={subscriptionModalOpen} title={t("Subscription")} description={t("Kelola paket dan perpanjang masa aktif otomatis via Pakasir.")} onClose={() => setSubscriptionModalOpen(false)}>
        <Card id="subscription" className="w-full min-w-0 max-w-full bg-white">
          <CardHeader>
            <CardTitle>{t("Subscription")}</CardTitle>
            <CardDescription>{t("Kelola paket dan perpanjang masa aktif otomatis via Pakasir.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptionReminder ? (
              <div className={subscriptionReminder.tone === "danger" ? "rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" : "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"}>
                <p className="font-black">{subscriptionReminder.title}</p>
                <p className="mt-1 text-sm font-semibold">{subscriptionReminder.description}</p>
              </div>
            ) : null}
            <div className="rounded-2xl border border-[#bccac0] bg-[#f8f9ff] p-4">
              <p className="text-sm font-bold text-[#3d4a42]">{t("Paket Aktif")}</p>
              <p className="mt-1 text-2xl font-black capitalize text-[#0b1c30]">{adminProfile?.planType || "pro"}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-[#3d4a42]"><CalendarDays className="h-4 w-4 text-primary" /> {t("Masa aktif:")} {adminProfile?.activeUntil || t("Tanpa batas")}</p>
            </div>
            <p className="rounded-2xl bg-[#eff4ff] p-3 text-sm font-semibold text-[#3d4a42]">{t("Klik kotak paket untuk memilih, lalu bayar dari tombol di bawah.")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {commercialPlanDetails.map((plan) => (
                <button
                  key={plan.name}
                  type="button"
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setInvoice(null);
                  }}
                  className={`min-h-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(11,28,48,0.10)] ${selectedPlan === plan.id ? "border-primary bg-emerald-50 ring-2 ring-primary/20" : adminProfile?.planType === plan.id ? "border-primary bg-emerald-50" : "border-[#d9e3de] bg-[#f8f9ff]"}`}
                  aria-pressed={selectedPlan === plan.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-[#0b1c30]">{plan.name}</p>
                      <p className="text-sm font-extrabold text-primary">{plan.id === "pro" ? (billingPeriod === "monthly" ? "Rp49.000 / bulan" : "Rp39.000 / bulan") : plan.id === "business" ? (billingPeriod === "monthly" ? "Rp129.000 / bulan" : "Rp99.000 / bulan") : plan.price}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {adminProfile?.planType === plan.id ? <Badge variant="success">{t("Aktif")}</Badge> : null}
                      {selectedPlan === plan.id ? <Badge variant="blue">{t("Dipilih")}</Badge> : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-[#3d4a42]">{plan.note}</p>
                  <ul className="mt-3 space-y-1.5 text-xs font-semibold text-[#0b1c30]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <div className="flex justify-center"><div className="inline-flex rounded-full border border-[#d9e3de] bg-white p-1"><button type="button" onClick={() => setBillingPeriod("monthly")} className={`rounded-full px-4 py-2 text-sm font-black ${billingPeriod === "monthly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Bulanan</button><button type="button" onClick={() => setBillingPeriod("yearly")} className={`rounded-full px-4 py-2 text-sm font-black ${billingPeriod === "yearly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Tahunan</button></div></div>
            <Button
              className="w-full min-h-12 whitespace-normal px-4 text-center text-sm leading-tight sm:text-base"
              size="lg"
              disabled={subscriptionLoading || selectedPlanDetail.id === "trial"}
              onClick={() => {
                if (selectedPlanDetail.id === "trial" || !selectedPlanDetail.billingPeriod) return;
                createSubscriptionInvoice(selectedPlanDetail.id, billingPeriod);
              }}
            >
              {subscriptionLoading ? t("Membuat invoice...") : selectedPlanDetail.id === "trial" ? t("Paket Free tidak perlu pembayaran") : `${t("Bayar Paket")} ${selectedPlanDetail.name} ${selectedPlanPrice}`}
            </Button>
            {invoice ? (
              <div className="rounded-2xl border border-[#bccac0] bg-white p-4 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><QrCode className="h-5 w-5" /></div>
                <p className="font-black text-[#0b1c30]">{t("Bayar invoice subscription")}</p>
                <p className="text-sm text-[#3d4a42]">{formatCurrency(invoice.totalPayment || invoice.amount)}</p>
                {invoice.qrImageDataUrl ? <img src={invoice.qrImageDataUrl} alt="QRIS Subscription" className="mx-auto mt-3 h-48 w-48 rounded-2xl object-contain" /> : null}
                <div className="mt-3 grid gap-2">
                  {invoice.paymentUrl ? <a href={invoice.paymentUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary">Buka pembayaran Pakasir</a> : null}
                  <Button size="sm" onClick={checkSubscriptionPayment} disabled={subscriptionLoading}>{subscriptionLoading ? "Mengecek..." : "Cek Pembayaran"}</Button>
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-[#d9e3de] bg-[#f8f9ff] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-[#0b1c30]">{t("Histori Invoice Subscription")}</p>
                  <p className="text-xs font-semibold text-[#3d4a42]">Invoice menunggu berlaku 1 jam dan riwayat yang tidak dibayar terhapus otomatis setelah 24 jam. Invoice lunas tetap disimpan.</p>
                </div>
                <Badge variant="secondary">{subscriptionInvoices.length}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {subscriptionInvoices.slice(0, 4).map((row) => (
                  <div key={row.id} className="grid gap-2 rounded-xl border border-[#e1e9e4] bg-white p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-extrabold capitalize text-[#0b1c30]">{row.planType} • {row.billingPeriod === "yearly" ? t("Tahunan") : t("Bulanan")}</p>
                      <p className="text-xs font-semibold text-[#3d4a42]">{new Date(row.createdAt).toLocaleString("id-ID")} • {formatCurrency(row.totalPayment || row.amount)}</p>
                      {row.status === "pending" && row.expiredAt ? <p className="mt-1 text-[11px] font-bold text-amber-700">Bayar sebelum {new Date(row.expiredAt).toLocaleString("id-ID")}</p> : null}
                    </div>
                    <Badge variant={row.status === "paid" ? "success" : row.status === "pending" ? "warning" : "secondary"}>{row.status === "paid" ? "Lunas" : row.status === "pending" ? "Menunggu" : row.status === "expired" ? "Kedaluwarsa" : row.status}</Badge>
                  </div>
                ))}
                {subscriptionInvoices.length === 0 ? <p className="rounded-xl bg-white p-3 text-sm font-semibold text-[#3d4a42]">{t("Belum ada invoice subscription.")}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>
        </Modal>

        <Card className="w-full min-w-0 max-w-full bg-white xl:col-span-2">
          <CardHeader><CardTitle>{t("Transaksi Cabang")}</CardTitle><CardDescription className="break-words">{t("Periode Transaksi")}: {summaryStart} – {summaryEnd} ({t("8 terbaru")})</CardDescription></CardHeader>
          <CardContent className="w-full max-w-full overflow-x-auto px-4 sm:px-6 [-webkit-overflow-scrolling:touch]">
            <Table className="min-w-[640px]">
              <TableHeader><TableRow><TableHead>{t("Order")}</TableHead><TableHead>{t("Barang")}</TableHead><TableHead>{t("Metode")}</TableHead><TableHead>{t("Total")}</TableHead><TableHead>{t("Status")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {recentTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="max-w-[8rem] truncate whitespace-nowrap font-bold" title={transaction.id}>{shortOrderId(transaction.id)}</TableCell>
                    <TableCell className="max-w-[14rem] truncate" title={transaction.items?.map((item) => `${item.name} x${item.quantity}`).join(", ") || ""}>{transaction.items?.map((item) => `${item.name} x${item.quantity}`).join(", ") || "-"}</TableCell>
                    <TableCell>{t(paymentMethodLabel(transaction.paymentMethod))}</TableCell>
                    <TableCell>{formatCurrency(transaction.total)}</TableCell>
                    <TableCell><Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{t(transactionStatusLabel(transaction.status))}</Badge></TableCell>
                  </TableRow>
                ))}
                {recentTransactions.length === 0 ? <TableRow><TableCell colSpan={5} className="py-6 text-center text-[#64748b]">{t("Tidak ada transaksi pada periode ini.")}</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
