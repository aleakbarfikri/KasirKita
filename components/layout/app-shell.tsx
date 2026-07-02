"use client";

import Link from "next/link";
import { type FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppLanguage } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";
import { ApiError, api, type SessionUser } from "@/lib/api-client";
import { cacheSession, clearCachedSession, readCachedSession } from "@/lib/offline-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  AlertTriangle,
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  Code2,
  Globe2,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  NotebookTabs,
  Package,
  RefreshCw,
  Store,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";

const ownerNav = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/admins", label: "Admin Management", icon: Users },
  { href: "/owner/payments", label: "API Config", icon: Code2 },
  { href: "/owner/withdrawals", label: "Withdraw", icon: Wallet },
  { href: "/owner/debts", label: "Piutang Cabang", icon: NotebookTabs },
  { href: "/owner/activity", label: "Log Aktivitas", icon: Activity },
];

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pos", label: "POS Kasir", icon: Store },
  { href: "/admin/inventory", label: "Inventaris", icon: Package },
  { href: "/admin/transactions", label: "Transaction History", icon: History },
  { href: "/admin/shifts", label: "Shift Kasir", icon: Clock },
  { href: "/admin/cashiers", label: "Kelola Kasir", icon: KeyRound },
  { href: "/admin/debts", label: "Catatan Hutang", icon: NotebookTabs },
  { href: "/admin/withdraw", label: "Withdraw", icon: Wallet },
  { href: "/admin/activity", label: "Log Aktivitas", icon: Activity },
];

const cashierAllowedPaths = ["/admin/pos", "/admin/transactions", "/admin/shifts"];
const ownerWhatsappUrl = "https://wa.me/6285129292922";
const cashierNav = adminNav.filter((item) => cashierAllowedPaths.includes(item.href));
const appBrand = "KasirKita";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "warning" | "danger" | "success" | "info";
};

function isRecent(date?: string | null, hours = 24) {
  if (!date) return false;
  return Date.now() - new Date(date).getTime() <= hours * 60 * 60 * 1000;
}

function isDebtOverdue(dueDate?: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

function itemSummary(items?: Array<{ name: string; quantity: number }>) {
  if (!items?.length) return "Item transaksi belum tersedia.";
  return items.slice(0, 2).map((item) => `${item.name} x${item.quantity}`).join(", ");
}

const toneClass: Record<NotificationItem["tone"], string> = {
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  info: "bg-[#eff4ff] text-[#213145] ring-[#dae2fd]",
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/kasirkita-mark.png" alt="KasirKita" className={cn("shrink-0 object-contain", compact ? "h-10 w-10" : "h-14 w-14")} />
      {!compact ? (
        <div>
          <h1 className="text-2xl font-black tracking-tight text-primary">{appBrand}</h1>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({
  role,
  title,
  description,
  children,
  fullScreen = false,
}: {
  role: "owner" | "admin";
  title: string;
  description?: string;
  children: ReactNode;
  fullScreen?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useAppLanguage();
  const [user, setUser] = useState<SessionUser | null>(null);
  const nav = role === "owner" ? ownerNav : user?.role === "cashier" ? cashierNav : adminNav;
  const sessionState = authClient.useSession();
  const [checking, setChecking] = useState(true);
  const [authMessage, setAuthMessage] = useState("Memeriksa sesi login...");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileShopName, setProfileShopName] = useState("");
  const [profileShopAddress, setProfileShopAddress] = useState("");
  const [profileShopPhone, setProfileShopPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      setChecking(true);
      try {
        const me = await api.me();
        if (!alive) return;
        if (role === "admin" && me.user.role === "cashier" && !cashierAllowedPaths.includes(pathname)) {
          setAuthMessage("Kasir hanya dapat mengakses POS, Transaction History, dan Shift Kasir.");
          router.replace("/admin/pos");
          return;
        }

        const roleAllowed = me.user.role === role || (role === "admin" && me.user.role === "cashier");
        if (!roleAllowed) {
          setAuthMessage("Akun ini tidak memiliki akses ke halaman tersebut.");
          router.replace(me.user.role === "owner" ? "/owner" : "/admin");
          return;
        }
        cacheSession(me);
        setUser({ ...me.user, shopName: me.shop?.name ?? me.user.shopName });
        setProfileShopAddress(me.shop?.address ?? "");
        setProfileShopPhone(me.shop?.phone ?? "");
      } catch (err) {
        if (!alive) return;
        const cached = readCachedSession();
        const temporaryConnectionProblem =
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          !(err instanceof ApiError) ||
          err.status === 408 ||
          err.status >= 500;

        const cachedRoleAllowed = cached?.user?.role === role || (role === "admin" && cached?.user?.role === "cashier" && cashierAllowedPaths.includes(pathname));
        if (cached?.user && cachedRoleAllowed && temporaryConnectionProblem) {
          setUser(cached.user);
          setAuthMessage("Mode offline aktif. Sesi lokal dipakai sementara.");
          return;
        }

        setAuthMessage("Sesi berakhir. Mengarahkan ke halaman login...");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        if (alive) setChecking(false);
      }
    }

    checkAccess();
    return () => {
      alive = false;
    };
  }, [pathname, role, router]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setNotificationsLoading(true);
    setNotificationError(null);
    try {
      const items: NotificationItem[] = [];
      if (role === "owner") {
        const [withdrawalRows, debtRows, adminRows, transactionRows, productRows, cashierRows] = await Promise.all([
          api.owner.withdrawals.list(),
          api.owner.debts.list(),
          api.owner.admins.list(),
          api.transactions.list().catch(() => []),
          api.products.list().catch(() => []),
          api.owner.cashiers.list().catch(() => []),
        ]);

        const pendingCashiers = cashierRows.filter((row) => row.profile.approvalStatus === "pending");
        if (pendingCashiers.length > 0) {
          items.push({ id: "owner-cashier-approval", title: `${pendingCashiers.length} request kasir tambahan`, description: "Ada akun kasir tambahan yang menunggu approval Owner.", href: "/owner/admins", tone: "warning" });
        }

        const pendingWithdrawals = withdrawalRows.filter((row) => row.withdrawal.status === "pending" || row.withdrawal.status === "processed");
        if (pendingWithdrawals.length > 0) {
          items.push({ id: "owner-withdrawals", title: `${pendingWithdrawals.length} request withdraw`, description: "Ada request withdraw admin yang perlu dicek atau ditandai selesai.", href: "/owner/withdrawals", tone: "warning" });
        }

        const overdueDebts = debtRows.filter((row) => row.debt.status !== "paid" && isDebtOverdue(row.debt.dueDate));
        if (overdueDebts.length > 0) {
          items.push({ id: "owner-overdue-debts", title: `${overdueDebts.length} piutang melewati jatuh tempo`, description: "Pantau risiko piutang lintas UMKM dari dashboard owner.", href: "/owner/debts", tone: "danger" });
        }

        const noQrisAdmins = adminRows.filter((row) => row.profile.isActive && !row.shop.qrisStaticImageUrl);
        if (noQrisAdmins.length > 0) {
          items.push({ id: "owner-qris-static", title: `${noQrisAdmins.length} UMKM belum punya QRIS statis`, description: "Upload QRIS statis dari menu Admin Management agar pembayaran statis aktif.", href: "/owner/admins", tone: "info" });
        }

        const lowStock = productRows.filter((product) => product.isActive !== false && product.stock !== null && product.stock !== undefined && product.stock <= 5);
        if (lowStock.length > 0) {
          items.push({ id: "owner-low-stock", title: `${lowStock.length} produk stok rendah`, description: `${lowStock.slice(0, 3).map((product) => `${product.name} (${product.stock})`).join(", ")} perlu dicek.`, href: "/owner", tone: "warning" });
        }

        transactionRows.filter((transaction) => isRecent(transaction.createdAt, 12)).slice(0, 3).forEach((transaction) => {
          items.push({ id: `owner-trx-${transaction.id}`, title: `Transaksi ${transaction.status === "success" ? "sukses" : transaction.status}`, description: `${transaction.shopName || "UMKM"} • ${formatCurrency(transaction.total)} • ${itemSummary(transaction.items)}`, href: "/owner", tone: transaction.status === "success" ? "success" : transaction.status === "pending" ? "warning" : "info" });
        });
      } else {
        const [me, withdrawalRows, debtRows, transactionRows, productRows, cashierRows] = await Promise.all([
          api.me(),
          user.role === "cashier" ? Promise.resolve([]) : api.withdrawals.list(),
          user.role === "cashier" ? Promise.resolve([]) : api.debts.list(),
          api.transactions.list().catch(() => []),
          api.products.list().catch(() => []),
          user.role === "cashier" ? Promise.resolve([]) : api.cashiers.list().catch(() => []),
        ]);

        const activeDebts = debtRows.filter((debt) => debt.status !== "paid");
        if (activeDebts.length > 0) items.push({ id: "admin-active-debts", title: `${activeDebts.length} catatan hutang aktif`, description: "Masih ada pelanggan yang belum melunasi pembayaran.", href: "/admin/debts", tone: "warning" });

        debtRows.filter((debt) => debt.status !== "paid" && Boolean(debt.transactionId) && isRecent(debt.createdAt, 12)).slice(0, 3).forEach((debt) => {
          items.push({ id: `admin-new-debt-${debt.id}`, title: "Hutang baru dari POS", description: `${debt.customerName} • ${formatCurrency(debt.amount)}${debt.customerPhone ? ` • ${debt.customerPhone}` : ""}`, href: "/admin/debts", tone: "warning" });
        });

        const overdueDebts = debtRows.filter((debt) => debt.status !== "paid" && isDebtOverdue(debt.dueDate));
        if (overdueDebts.length > 0) items.push({ id: "admin-overdue-debts", title: `${overdueDebts.length} hutang jatuh tempo`, description: "Ada catatan hutang yang melewati tanggal jatuh tempo.", href: "/admin/debts", tone: "danger" });

        const pendingWithdrawals = withdrawalRows.filter((row) => row.status === "pending" || row.status === "processed");
        if (pendingWithdrawals.length > 0) items.push({ id: "admin-withdrawals", title: `${pendingWithdrawals.length} request withdraw sedang diproses`, description: "Request penarikan saldo QRIS Pakasir sedang menunggu Owner.", href: "/admin/withdraw", tone: "info" });

        const pendingCashiers = cashierRows.filter((row) => row.profile.approvalStatus === "pending");
        if (pendingCashiers.length > 0) items.push({ id: "admin-cashier-pending", title: `${pendingCashiers.length} request kasir tambahan`, description: "Akun kasir tambahan sudah dibuat dan menunggu approval Owner.", href: "/admin/cashiers", tone: "warning" });

        const lowStock = productRows.filter((product) => product.isActive !== false && product.stock !== null && product.stock !== undefined && product.stock <= 5);
        if (lowStock.length > 0) items.push({ id: "admin-low-stock", title: `${lowStock.length} produk stok rendah`, description: `${lowStock.slice(0, 3).map((product) => `${product.name} (${product.stock})`).join(", ")} perlu restock.`, href: "/admin/inventory", tone: "warning" });

        transactionRows.filter((transaction) => isRecent(transaction.createdAt, 12)).slice(0, 3).forEach((transaction) => {
          items.push({ id: `admin-trx-${transaction.id}`, title: `Transaksi ${transaction.status === "success" ? "sukses" : transaction.status}`, description: `${formatCurrency(transaction.total)} • ${itemSummary(transaction.items)}`, href: "/admin/transactions", tone: transaction.status === "success" ? "success" : transaction.status === "pending" ? "warning" : "info" });
        });

        if (me.shop && !me.shop.qrisStaticImageUrl) {
          items.push({ id: "admin-qris-static", title: "QRIS statis belum tersedia", description: "Minta Owner upload QRIS statis untuk UMKM ini dari Admin Management.", href: "/admin/pos", tone: "info" });
        }
      }

      setNotifications(items.slice(0, 12));
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : "Gagal memuat notifikasi");
    } finally {
      setNotificationsLoading(false);
    }
  }, [role, user]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, loadNotifications]);

  const initials = useMemo(() => {
    const name = user?.name || user?.username || (role === "owner" ? "Owner" : "Admin");
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [role, user]);

  useEffect(() => {
    setMobileNavOpen(false);
    setNotificationOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  function openProfileModal() {
    setProfileName(user?.name || "");
    setProfileShopName(user?.shopName || "");
    setProfileShopAddress(profileShopAddress || "");
    setProfileShopPhone(profileShopPhone || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setProfileError(null);
    setProfileSuccess(null);
    setProfileOpen(false);
    setProfileModalOpen(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (newPassword || currentPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setProfileError("Password baru minimal 8 karakter.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setProfileError("Konfirmasi password baru tidak sama.");
        return;
      }
    }

    setProfileSaving(true);

    try {
      const result = await api.profile.update({
        name: profileName,
        shopName: profileShopName,
        shopAddress: profileShopAddress,
        shopPhone: profileShopPhone,
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setUser((current) => {
        if (!current) return result.user;
        return { ...current, ...result.user };
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileSuccess("Profil berhasil diperbarui.");
      router.refresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Gagal menyimpan profil.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    clearCachedSession();
    router.replace("/login");
    router.refresh();
  }

  if (checking || sessionState.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f9ff] p-6 text-[#0b1c30]">
        <div className="rounded-3xl border border-[#bccac0] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-primary" />
          <p className="text-lg font-extrabold">{appBrand}</p>
          <p className="mt-2 text-sm text-[#3d4a42]">{authMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <div className={cn("min-h-screen bg-[#f8f9ff] text-[#0b1c30]", fullScreen && "lg:h-screen lg:overflow-hidden")}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] flex-col border-r border-[#bccac0] bg-[#f8f9ff] lg:flex">
        <div className="px-6 py-7">
          <Link href="/" className="block">
            <BrandMark />
          </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 text-sm font-semibold text-[#3d4a42] transition-colors hover:bg-[#dce9ff]",
                  active && "border-r-4 border-primary bg-primary/10 text-primary",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#bccac0] p-6">
          <div className="rounded-2xl border border-[#bccac0] bg-[#eff4ff] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#0b1c30]">{user?.name || user?.username}</p>
              <p className="truncate text-xs text-[#3d4a42]">{role === "owner" ? t("Owner Account") : user?.role === "cashier" ? t("Kasir UMKM") : user?.shopName || t("Admin UMKM")}</p>
              </div>
            </div>
            {role === "admin" ? (
              <a href={ownerWhatsappUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-700">
                <MessageCircle className="h-3.5 w-3.5" /> Contact Us
              </a>
            ) : null}
            <button onClick={signOut} className="mt-4 flex items-center gap-2 text-xs font-bold text-primary">
              <LogOut className="h-3.5 w-3.5" /> {t("Logout")}
            </button>
          </div>
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-[#0b1c30]/45 backdrop-blur-sm"
            aria-label="Tutup menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[86vw] max-w-[330px] flex-col border-r border-[#bccac0] bg-[#f8f9ff] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Link href={role === "owner" ? "/owner" : "/admin"} className="flex items-center gap-2">
                <BrandMark compact />
                <span className="text-2xl font-black tracking-tight text-primary">{appBrand}</span>
              </Link>
              <button
                className="rounded-full border border-[#bccac0] bg-white p-2 text-[#0b1c30]"
                aria-label="Tutup menu"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 pb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#3d4a42]">
              Menu {role === "owner" ? t("Owner") : t("Admin")}
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
              {nav.map((item) => {
                const active = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-4 text-base font-bold text-[#3d4a42] transition-colors active:scale-[0.98]",
                      active ? "bg-primary text-white" : "hover:bg-[#dce9ff]",
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{t(item.label)}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[#bccac0] p-4">
              <div className="rounded-2xl border border-[#bccac0] bg-[#eff4ff] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0b1c30]">{user?.name || user?.username}</p>
                    <p className="truncate text-xs text-[#3d4a42]">{role === "owner" ? t("Owner Account") : user?.role === "cashier" ? t("Kasir UMKM") : user?.shopName || t("Admin UMKM")}</p>
                  </div>
                </div>
                {role === "admin" ? (
                  <a href={ownerWhatsappUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-700">
                    <MessageCircle className="h-4 w-4" /> Contact Us
                  </a>
                ) : null}
                <button onClick={signOut} className="mt-4 flex items-center gap-2 text-sm font-bold text-primary">
                  <LogOut className="h-4 w-4" /> {t("Logout")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <main className="lg:pl-[280px]">
        <header className="sticky top-0 z-20 flex min-h-[64px] items-center justify-between border-b border-[#bccac0] bg-white/95 px-3 backdrop-blur lg:min-h-[68px] lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex items-center gap-2 lg:hidden">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#bccac0] bg-white text-primary shadow-sm"
                aria-label="Buka menu"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link href={role === "owner" ? "/owner" : "/admin"} className="flex items-center text-lg font-black text-primary" aria-label={appBrand}>
                <BrandMark compact />
              </Link>
            </div>
            <div className="hidden w-full max-w-[440px] items-center rounded-2xl bg-[#e5eeff] px-4 py-2.5 text-sm text-[#3d4a42] md:flex">
              <Menu className="mr-2 h-5 w-5" /> {role === "owner" ? t("Area Owner") : user?.shopName || t("Area Admin")}
            </div>
            <div className="hidden border-l border-[#bccac0] pl-4 text-sm md:block">
              <p className="uppercase tracking-[0.16em] text-[#3d4a42]">{t("Login sebagai")}</p>
              <p className="font-bold text-primary">{role === "owner" ? t("Owner") : t("Admin")}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-3">
            <button
              className="relative rounded-full p-2 hover:bg-[#e5eeff]"
              aria-label="Notifikasi"
              onClick={() => {
                setNotificationOpen((value) => !value);
                setProfileOpen(false);
                if (!notificationOpen) loadNotifications();
              }}
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-600" /> : null}
            </button>

            {notificationOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-[#bccac0] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#e3e9e5] px-4 py-3">
                  <div>
                    <p className="font-extrabold text-[#0b1c30]">Notifikasi</p>
                    <p className="text-xs text-[#3d4a42]">Update penting akun {role === "owner" ? "Owner" : "Admin"}</p>
                  </div>
                  <button onClick={loadNotifications} className="rounded-full p-2 text-primary hover:bg-[#e5eeff]" aria-label="Refresh notifikasi">
                    <RefreshCw className={cn("h-4 w-4", notificationsLoading && "animate-spin")} />
                  </button>
                </div>

                <div className="max-h-[360px] overflow-y-auto p-3">
                  {notificationError ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{notificationError}</p> : null}
                  {notificationsLoading && !notificationError ? <p className="rounded-2xl bg-[#eff4ff] p-3 text-sm text-[#3d4a42]">Memuat notifikasi...</p> : null}

                  {!notificationsLoading && !notificationError && notifications.length === 0 ? (
                    <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                      <div className="mb-2 flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Tidak ada notifikasi baru</div>
                      Semua transaksi, withdraw, dan catatan penting sedang aman.
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {notifications.map((item) => (
                      <Link
                        href={item.href}
                        key={item.id}
                        onClick={() => setNotificationOpen(false)}
                        className="block rounded-2xl border border-[#e3e9e5] p-3 transition hover:bg-[#f8f9ff]"
                      >
                        <div className="flex gap-3">
                          <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1", toneClass[item.tone])}>
                            {item.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : item.tone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-[#0b1c30]">{item.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-[#3d4a42]">{item.description}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-1 rounded-full border border-[#bccac0] bg-[#eff4ff] p-1 text-xs font-extrabold text-primary">
              <Globe2 className="ml-2 hidden h-4 w-4 sm:block" />
              <button
                type="button"
                onClick={() => setLanguage("id")}
                className={cn("rounded-full px-3 py-1.5 transition", language === "id" ? "bg-primary text-white shadow-sm" : "text-[#3d4a42] hover:bg-white")}
                aria-pressed={language === "id"}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={cn("rounded-full px-3 py-1.5 transition", language === "en" ? "bg-primary text-white shadow-sm" : "text-[#3d4a42] hover:bg-white")}
                aria-pressed={language === "en"}
              >
                EN
              </button>
            </div>
            <button
              onClick={() => {
                setProfileOpen((value) => !value);
                setNotificationOpen(false);
              }}
              className="rounded-full border-2 border-primary p-2 text-primary transition hover:bg-primary hover:text-white"
              aria-label="Buka profil"
              aria-expanded={profileOpen}
            >
              <UserRound className="h-5 w-5" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[min(92vw,320px)] overflow-hidden rounded-3xl border border-[#bccac0] bg-white shadow-2xl">
                <div className="border-b border-[#e3e9e5] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-[#0b1c30]">{user?.name || user?.username}</p>
                      <p className="truncate text-xs text-[#3d4a42]">{role === "owner" ? t("Owner Account") : user?.shopName || t("Admin UMKM")}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-3">
                  <button
                    onClick={openProfileModal}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-[#0b1c30] transition hover:bg-[#eff4ff]"
                  >
                    <UserRound className="h-4 w-4 text-primary" />
                    {t("Profil & Password")}
                  </button>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-red-700 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("Logout")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {fullScreen ? (
          <div className="min-h-[calc(100vh-64px)] overflow-y-auto pb-24 lg:h-[calc(100vh-68px)] lg:overflow-hidden lg:pb-0">{children}</div>
        ) : (
          <div className="p-4 pb-24 lg:p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t(title)}</h2>
              {description ? <p className="mt-1 text-base text-[#3d4a42]">{t(description)}</p> : null}
            </div>
            {children}
          </div>
        )}
      </main>

      <Modal
        open={profileModalOpen}
        title={t("Profil Akun")}
        description={role === "owner" ? "Kelola nama owner, nama toko/UMKM, dan password." : "Kelola nama admin/kasir dan password login."}
        onClose={() => setProfileModalOpen(false)}
      >
        <form onSubmit={saveProfile} className="space-y-5">
          {profileError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{profileError}</p> : null}
          {profileSuccess ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{profileSuccess}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profileName">{role === "owner" ? t("Nama Owner") : t("Nama Admin")}</Label>
              <Input
                id="profileName"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                minLength={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileShopName">{role === "owner" ? "Nama Toko/UMKM" : "Nama Tim/Admin"}</Label>
              <Input
                id="profileShopName"
                value={profileShopName}
                onChange={(event) => setProfileShopName(event.target.value)}
                minLength={2}
                required
              />
            </div>
          </div>

          {role === "admin" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profileShopAddress">Catatan alamat/area kerja</Label>
                <Input
                  id="profileShopAddress"
                  value={profileShopAddress}
                  onChange={(event) => setProfileShopAddress(event.target.value)}
                  placeholder="Jl. Melati No. 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileShopPhone">Nomor kontak admin</Label>
                <Input
                  id="profileShopPhone"
                  value={profileShopPhone}
                  onChange={(event) => setProfileShopPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[#bccac0] bg-[#f8f9ff] p-4">
            <div className="mb-4 flex items-center gap-2 font-extrabold text-[#0b1c30]">
              <KeyRound className="h-4 w-4 text-primary" />
              {t("Ganti Password")}
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t("Password Lama")}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t("Password Baru")}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("Konfirmasi Password")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setProfileModalOpen(false)}>
              Tutup
            </Button>
            <Button type="submit" disabled={profileSaving}>
              {profileSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {profileSaving ? "Menyimpan..." : "Simpan Profil"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
