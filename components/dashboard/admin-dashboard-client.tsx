"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Loader2, NotebookTabs, QrCode, ReceiptText, Store, TrendingUp, Wallet } from "lucide-react";
import { api, debtStatusLabel, paymentMethodLabel, transactionStatusLabel, type AdminProfile, type DebtRecord, type SubscriptionInvoiceRecord, type TransactionRecord, type WithdrawalRecord } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useAppLanguage } from "@/lib/i18n";

type SubscriptionPlanChoice = "trial" | "basic" | "starter" | "pro" | "business";
type PaidSubscriptionPlanChoice = Exclude<SubscriptionPlanChoice, "trial">;

function isSubscriptionPlanChoice(value?: string | null): value is SubscriptionPlanChoice {
  return value === "trial" || value === "basic" || value === "starter" || value === "pro" || value === "business";
}

function isPaidSubscriptionPlanChoice(value?: string | null): value is PaidSubscriptionPlanChoice {
  return value === "basic" || value === "starter" || value === "pro" || value === "business";
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
  const searchParams = useSearchParams();
  const checkoutPlan = searchParams.get("checkoutPlan");
  const autoCheckoutStarted = useRef(false);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [subscriptionInvoices, setSubscriptionInvoices] = useState<SubscriptionInvoiceRecord[]>([]);
  const [invoice, setInvoice] = useState<SubscriptionInvoiceRecord | null>(null);
  const [shopName, setShopName] = useState("UMKM Berkah");
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanChoice>("starter");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [me, transactionRows, debtRows, withdrawalRows, invoiceRows] = await Promise.all([api.me(), api.transactions.list(), api.debts.list(), api.withdrawals.list(), api.subscription.listInvoices().catch(() => [])]);
        setShopName(me.user.shopName || "UMKM Berkah");
        setAdminProfile(me.adminProfile ?? null);
        setSelectedPlan(isPaidSubscriptionPlanChoice(checkoutPlan) ? checkoutPlan : isSubscriptionPlanChoice(me.adminProfile?.planType) && me.adminProfile?.planType !== "trial" ? me.adminProfile.planType : "starter");
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
  }, [checkoutPlan]);

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
    createSubscriptionInvoice(checkoutPlan, defaultBillingPeriod[checkoutPlan]);
  }, [checkoutPlan, loading]);

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

  const planDetails = [
    {
      id: "trial" as const,
      name: "Trial",
      price: t("Gratis 14 hari"),
      billingPeriod: null,
      note: t("Cocok untuk coba POS dasar sebelum berlangganan."),
      features: [t("100 produk"), t("1 kasir"), t("500 transaksi/bulan"), t("POS kasir"), t("Inventaris produk"), t("Diskon aktif"), t("Struk thermal dasar"), t("Riwayat transaksi terbatas"), t("Tanpa QRIS Pakasir"), t("Tanpa import/export")],
    },
    {
      id: "basic" as const,
      name: "Basic",
      price: t("Rp100.000 / tahun"),
      billingPeriod: "yearly" as const,
      note: t("Paket hemat untuk toko kecil dengan transaksi sederhana."),
      features: [t("300 produk"), t("1 kasir"), t("500 transaksi/bulan"), t("POS kasir"), t("Inventaris produk"), t("Diskon aktif"), t("Struk thermal dasar"), t("QRIS statis manual"), t("Riwayat transaksi"), t("Tanpa QRIS Pakasir"), t("Tanpa shift kasir")],
    },
    {
      id: "starter" as const,
      name: "Starter",
      price: t("Rp19.000 / bulan"),
      billingPeriod: "monthly" as const,
      note: t("Untuk UMKM kecil yang butuh POS lebih lega dengan diskon aktif."),
      features: [t("500 produk"), t("1 kasir"), t("1.000 transaksi/bulan"), t("POS kasir"), t("Inventaris produk"), t("Diskon aktif"), t("QRIS statis manual"), t("Struk thermal 58/80mm"), t("Riwayat transaksi"), t("Laporan sederhana"), t("Tanpa QRIS Pakasir")],
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: t("Rp49.000 / bulan"),
      billingPeriod: "monthly" as const,
      note: t("Untuk UMKM yang mulai butuh kontrol stok dan pembayaran lebih lengkap."),
      features: [t("1.000 produk"), t("3 kasir"), t("3.000 transaksi/bulan"), t("Semua fitur Starter"), t("Import/export Excel/CSV"), t("QRIS Pakasir otomatis"), t("Catatan hutang pelanggan"), t("Shift kasir"), t("Laporan omzet dan laba"), t("Backup manual")],
    },
    {
      id: "business" as const,
      name: "Business",
      price: t("Rp99.000 / bulan"),
      billingPeriod: "monthly" as const,
      note: t("Untuk toko yang butuh kapasitas besar tanpa batas utama."),
      features: [t("Produk tanpa batas"), t("Kasir tanpa batas"), t("Transaksi tanpa batas"), t("Semua fitur Pro aktif"), t("Backup otomatis"), t("Restore data"), t("Dashboard owner lengkap"), t("Log aktivitas"), t("Export laporan"), t("Prioritas support")],
    },
  ];
  const selectedPlanDetail = planDetails.find((plan) => plan.id === selectedPlan) ?? planDetails[1];
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

        <Card id="subscription" className="w-full min-w-0 max-w-full scroll-mt-24 bg-white">
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
              {planDetails.map((plan) => (
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
                      <p className="text-sm font-extrabold text-primary">{plan.price}</p>
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
            <Button
              className="w-full"
              size="lg"
              disabled={subscriptionLoading || selectedPlanDetail.id === "trial"}
              onClick={() => {
                if (selectedPlanDetail.id === "trial" || !selectedPlanDetail.billingPeriod) return;
                createSubscriptionInvoice(selectedPlanDetail.id, selectedPlanDetail.billingPeriod);
              }}
            >
              {subscriptionLoading ? t("Membuat invoice...") : selectedPlanDetail.id === "trial" ? t("Trial tidak perlu pembayaran") : `${t("Bayar Paket")} ${selectedPlanDetail.name} ${selectedPlanDetail.price}`}
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
                  <p className="text-xs font-semibold text-[#3d4a42]">{t("Cek status pembayaran paket terbaru.")}</p>
                </div>
                <Badge variant="secondary">{subscriptionInvoices.length}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {subscriptionInvoices.slice(0, 4).map((row) => (
                  <div key={row.id} className="grid gap-2 rounded-xl border border-[#e1e9e4] bg-white p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-extrabold capitalize text-[#0b1c30]">{row.planType} • {row.billingPeriod === "yearly" ? t("Tahunan") : t("Bulanan")}</p>
                      <p className="text-xs font-semibold text-[#3d4a42]">{new Date(row.createdAt).toLocaleString("id-ID")} • {formatCurrency(row.totalPayment || row.amount)}</p>
                    </div>
                    <Badge variant={row.status === "paid" ? "success" : row.status === "pending" ? "warning" : "secondary"}>{t(row.status === "paid" ? "Lunas" : row.status === "pending" ? "Menunggu" : row.status)}</Badge>
                  </div>
                ))}
                {subscriptionInvoices.length === 0 ? <p className="rounded-xl bg-white p-3 text-sm font-semibold text-[#3d4a42]">{t("Belum ada invoice subscription.")}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full bg-white xl:col-span-2">
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
