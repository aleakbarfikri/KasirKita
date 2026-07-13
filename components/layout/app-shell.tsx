"use client";

import Link from "next/link";
import { type FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppLanguage } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";
import { ApiError, api, type SessionUser } from "@/lib/api-client";
import { cacheSession, clearCachedSession, readCachedSession } from "@/lib/offline-session";
import { clearOfflineData, readOfflineCheckouts } from "@/lib/offline-pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { GlobalSubscriptionModal } from "@/components/subscription/global-subscription-modal";
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
          <h1 className="text-xl font-black tracking-tight text-primary">{appBrand}</h1>
          <p className="text-xs font-bold text-[#505f76]">POS Platform</p>
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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
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

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  async function enableDeviceNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      const seedKey = `kasirkita-notifications-seen-${role}-${user?.id ?? "user"}`;
      window.localStorage.setItem(seedKey, JSON.stringify(notifications.map((item) => item.id).slice(0, 80)));
      new Notification("KasirKita", {
        body: "Notifikasi device aktif. Aktivitas baru akan muncul dari browser ini.",
        tag: "kasirkita-notification-enabled",
      });
    }
  }

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
        if (pendingWithdrawals.length > 0) items.push({ id: "admin-withdrawals", title: `${pendingWithdrawals.length} request withdraw sedang diproses`, description: "Request penarikan saldo QRIS KasirKita sedang menunggu Owner.", href: "/admin/withdraw", tone: "info" });

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

      const nextItems = items.slice(0, 12);
      setNotifications(nextItems);

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const seenKey = `kasirkita-notifications-seen-${role}-${user.id}`;
        let seenIds: string[] = [];
        try {
          seenIds = JSON.parse(window.localStorage.getItem(seenKey) || "[]");
        } catch {
          seenIds = [];
        }

        const seen = new Set(seenIds);
        const freshItems = nextItems.filter((item) => !seen.has(item.id)).slice(0, 3);
        freshItems.forEach((item) => {
          new Notification(`KasirKita: ${item.title}`, {
            body: item.description,
            tag: item.id,
          });
        });

        const merged = [...nextItems.map((item) => item.id), ...seenIds].filter((id, index, array) => array.indexOf(id) === index).slice(0, 100);
        window.localStorage.setItem(seenKey, JSON.stringify(merged));
      }
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
    setProfileEmail(user?.email || "");
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

    if (!/^\S+@\S+\.\S+$/.test(profileEmail.trim())) {
      setProfileError("Format email tidak valid.");
      return;
    }
    if (profileEmail.trim().toLowerCase() !== user?.email?.toLowerCase() && !currentPassword) {
      setProfileError("Masukkan password saat ini untuk mengubah email.");
      return;
    }

    if (newPassword || currentPassword || confirmPassword) {
      if ((newPassword || confirmPassword) && newPassword.length < 12) {
        setProfileError("Password baru minimal 12 karakter.");
        return;
      }

      if ((newPassword || confirmPassword) && newPassword !== confirmPassword) {
        setProfileError("Konfirmasi password baru tidak sama.");
        return;
      }
    }

    setProfileSaving(true);

    try {
      const result = await api.profile.update({
        name: profileName,
        email: profileEmail,
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
    if (readOfflineCheckouts().length > 0) {
      window.alert("Masih ada transaksi offline yang belum tersinkron. Sambungkan internet dan sinkronkan terlebih dahulu agar transaksi tidak hilang.");
      return;
    }
    await authClient.signOut();
    clearCachedSession();
    await clearOfflineData();
    router.replace("/login");
    router.refresh();
  }

  if (checking || sessionState.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6 text-[#0f172a]">
        <div className="rounded-xl border border-[#d7e2dc] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-xl bg-primary" />
          <p className="text-lg font-extrabold">{appBrand}</p>
          <p className="mt-2 text-sm font-medium text-[#64748b]">{authMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <div className={cn("min-h-screen bg-[#faf8ff] text-[#151b2d]", fullScreen && "lg:h-screen lg:overflow-hidden")}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#bec9c1] bg-white">
        <div className="px-6 py-6">
          <Link href="/" className="block">
            <BrandMark />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative -mr-4 flex items-center gap-3 rounded-l-xl px-4 py-3 text-sm font-bold text-[#505f76] transition-colors hover:bg-[#f8fafc] hover:text-[#151b2d]",
                  active && "border-r-4 border-primary bg-[#006948]/10 text-primary",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#bec9c1] p-5">
          <div className="rounded-xl border border-[#bec9c1] bg-[#f8fafc] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#0f172a]">{user?.name || user?.username}</p>
              <p className="truncate text-xs font-medium text-[#64748b]">{role === "owner" ? t("Owner Account") : user?.role === "cashier" ? t("Kasir UMKM") : user?.shopName || t("Admin UMKM")}</p>
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
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-[#0f172a]/45 backdrop-blur-sm"
            aria-label="Tutup menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[86vw] max-w-[330px] flex-col border-r border-[#d7e2dc] bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Link href={role === "owner" ? "/owner" : "/admin"} className="flex items-center gap-2">
                <BrandMark compact />
                <span className="text-2xl font-black tracking-tight text-primary">{appBrand}</span>
              </Link>
              <button
                className="rounded-full border border-[#d7e2dc] bg-white p-2 text-[#0f172a]"
                aria-label="Tutup menu"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 pb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#64748b]">
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
                      "flex items-center gap-3 rounded-lg px-4 py-4 text-base font-bold text-[#475569] transition-colors active:scale-[0.98]",
                      active ? "bg-primary text-white shadow-sm" : "hover:bg-[#f1f5f9]",
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{t(item.label)}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[#e2e8f0] p-4">
              <div className="rounded-xl border border-[#d7e2dc] bg-[#f8fafc] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0f172a]">{user?.name || user?.username}</p>
                    <p className="truncate text-xs font-medium text-[#64748b]">{role === "owner" ? t("Owner Account") : user?.role === "cashier" ? t("Kasir UMKM") : user?.shopName || t("Admin UMKM")}</p>
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

      <main>
        <header className="sticky top-0 z-20 flex min-h-[64px] items-center justify-between border-b border-[#bec9c1] bg-white/95 px-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d7e2dc] bg-white text-primary shadow-sm"
                aria-label="Buka menu"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link href={role === "owner" ? "/owner" : "/admin"} className="flex items-center text-lg font-black text-primary" aria-label={appBrand}>
                <BrandMark compact />
              </Link>
            </div>
            <div className="hidden border-l border-[#bec9c1] pl-4 text-sm md:block">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#64748b]">{t("Login sebagai")}</p>
              <p className="font-bold text-primary">{role === "owner" ? t("Owner") : t("Admin")}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-3">
            <button
              className="relative rounded-full p-2 hover:bg-[#f8fafc]"
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
              <div className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-[#d7e2dc] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
                  <div>
                    <p className="font-extrabold text-[#0f172a]">Notifikasi</p>
                    <p className="text-xs font-medium text-[#64748b]">Update penting akun {role === "owner" ? "Owner" : "Admin"}</p>
                  </div>
                  <button onClick={loadNotifications} className="rounded-full p-2 text-primary hover:bg-[#f1f5f9]" aria-label="Refresh notifikasi">
                    <RefreshCw className={cn("h-4 w-4", notificationsLoading && "animate-spin")} />
                  </button>
                </div>

                <div className="max-h-[360px] overflow-y-auto p-3">
                  {notificationError ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{notificationError}</p> : null}
                  {notificationsLoading && !notificationError ? <p className="rounded-xl bg-[#f1f5f9] p-3 text-sm font-medium text-[#64748b]">Memuat notifikasi...</p> : null}
                  <div className="mb-3 rounded-xl border border-[#d7e2dc] bg-[#f8fafc] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-[#0f172a]">{t("Notifikasi Device")}</p>
                        <p className="text-xs font-semibold text-[#64748b]">
                          {notificationPermission === "granted" ? t("Aktif di browser ini") : notificationPermission === "denied" ? t("Izin ditolak di browser") : notificationPermission === "unsupported" ? t("Browser tidak mendukung") : t("Aktifkan agar aktivitas masuk ke device")}
                        </p>
                      </div>
                      <Button size="sm" variant={notificationPermission === "granted" ? "secondary" : "outline"} onClick={enableDeviceNotifications} disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}>
                        {notificationPermission === "granted" ? t("Aktif") : t("Aktifkan")}
                      </Button>
                    </div>
                  </div>

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
                        className="block rounded-xl border border-[#e2e8f0] p-3 transition hover:border-[#b6c9bf] hover:bg-[#f8fafc]"
                      >
                        <div className="flex gap-3">
                          <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1", toneClass[item.tone])}>
                            {item.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : item.tone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-[#0f172a]">{item.title}</p>
                            <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748b]">{item.description}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-1 rounded-full border border-[#bec9c1] bg-[#f8fafc] p-1 text-xs font-extrabold text-primary">
              <Globe2 className="ml-2 hidden h-4 w-4 sm:block" />
              <button
                type="button"
                onClick={() => setLanguage("id")}
                className={cn("rounded-full px-3 py-1.5 transition", language === "id" ? "bg-primary text-white shadow-sm" : "text-[#475569] hover:bg-white")}
                aria-pressed={language === "id"}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={cn("rounded-full px-3 py-1.5 transition", language === "en" ? "bg-primary text-white shadow-sm" : "text-[#475569] hover:bg-white")}
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
              className="rounded-full border border-primary p-2 text-primary transition hover:bg-primary hover:text-white"
              aria-label="Buka profil"
              aria-expanded={profileOpen}
            >
              <UserRound className="h-5 w-5" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[min(92vw,320px)] overflow-hidden rounded-xl border border-[#d7e2dc] bg-white shadow-2xl">
                <div className="border-b border-[#e2e8f0] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-[#0f172a]">{user?.name || user?.username}</p>
                      <p className="truncate text-xs font-medium text-[#64748b]">{role === "owner" ? t("Owner Account") : user?.shopName || t("Admin UMKM")}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-3">
                  <button
                    onClick={openProfileModal}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-[#0f172a] transition hover:bg-[#f1f5f9]"
                  >
                    <UserRound className="h-4 w-4 text-primary" />
                    {t("Profil & Password")}
                  </button>
                  {role === "admin" ? (
                    <Link
                      href="/admin?subscription=1"
                      onClick={(event) => {
                        event.preventDefault();
                        setProfileOpen(false);
                        window.dispatchEvent(new Event("kasirkita:open-subscription"));
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-[#0f172a] transition hover:bg-[#f1f5f9]"
                    >
                      <Activity className="h-4 w-4 text-primary" />
                      {t("Paket Subscription")}
                    </Link>
                  ) : null}
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-red-700 transition hover:bg-red-50"
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
            <div className="mx-auto w-full max-w-[1184px]">
            <div className="mb-8">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-primary">{role === "owner" ? t("Owner Area") : t("Admin Area")}</p>
              <h2 className="text-3xl font-black tracking-tight text-[#151b2d] md:text-4xl">{t(title)}</h2>
              {description ? <p className="mt-2 max-w-3xl text-base font-semibold leading-relaxed text-[#505f76]">{t(description)}</p> : null}
            </div>
            {children}
            </div>
          </div>
        )}
      </main>

      <Modal
        open={profileModalOpen}
        title={t("Profil Akun")}
        description={role === "owner" ? "Kelola nama Owner, email, identitas platform, dan password." : "Kelola identitas admin, email, alamat, telepon, dan password login."}
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
              <Label htmlFor="profileEmail">Email</Label>
              <Input
                id="profileEmail"
                type="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profileShopName">{role === "owner" ? "Nama Platform/UMKM" : "Nama UMKM"}</Label>
              <Input
                id="profileShopName"
                value={profileShopName}
                onChange={(event) => setProfileShopName(event.target.value)}
                minLength={2}
                required
              />
            </div>
          </div>

          {user?.role === "admin" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profileShopAddress">Alamat Toko/UMKM</Label>
                <Input
                  id="profileShopAddress"
                  value={profileShopAddress}
                  onChange={(event) => setProfileShopAddress(event.target.value)}
                  placeholder="Jl. Melati No. 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileShopPhone">Nomor Telepon</Label>
                <Input
                  id="profileShopPhone"
                  type="tel"
                  value={profileShopPhone}
                  onChange={(event) => setProfileShopPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-[#d7e2dc] bg-[#f8fafc] p-4">
            <div className="mb-4 flex items-center gap-2 font-extrabold text-[#0f172a]">
              <KeyRound className="h-4 w-4 text-primary" />
              {t("Keamanan Akun")}
            </div>
            <p className="mb-4 text-xs font-semibold text-[#64748b]">Password saat ini wajib diisi jika mengubah email atau password.</p>
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
                    minLength={12}
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
                    minLength={12}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {role === "admin" && user?.role === "admin" ? (
              <Link href="/account/delete" onClick={() => setProfileModalOpen(false)} className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-bold text-red-700 shadow-sm hover:bg-red-50 sm:mr-auto">Hapus Akun</Link>
            ) : null}
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
      {role === "admin" && pathname !== "/admin" ? <GlobalSubscriptionModal /> : null}
    </div>
  );
}
