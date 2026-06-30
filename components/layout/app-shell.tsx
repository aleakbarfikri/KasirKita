"use client";

import Link from "next/link";
import { type FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { api, type SessionUser } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Code2,
  DollarSign,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  NotebookTabs,
  Package,
  RefreshCw,
  Store,
  UserRound,
  Users,
  X,
  Wallet,
} from "lucide-react";

const ownerNav = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/admins", label: "Admin Management", icon: Users },
  { href: "/owner/payments", label: "API Config", icon: Code2 },
  { href: "/owner/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/owner/debts", label: "Piutang Cabang", icon: NotebookTabs },
];

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pos", label: "POS Kasir", icon: Store },
  { href: "/admin/inventory", label: "Inventaris", icon: Package },
  { href: "/admin/transactions", label: "Transaction History", icon: History },
  { href: "/admin/debts", label: "Catatan Hutang", icon: NotebookTabs },
  { href: "/admin/withdraw", label: "Withdrawals", icon: Wallet },
];

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "warning" | "danger" | "success" | "info";
};

function isDebtOverdue(dueDate?: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

const toneClass: Record<NotificationItem["tone"], string> = {
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  info: "bg-[#eff4ff] text-[#213145] ring-[#dae2fd]",
};

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
  const nav = role === "owner" ? ownerNav : adminNav;
  const sessionState = authClient.useSession();
  const [user, setUser] = useState<SessionUser | null>(null);
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
        if (me.user.role !== role) {
          setAuthMessage("Akun ini tidak memiliki akses ke halaman tersebut.");
          router.replace(me.user.role === "owner" ? "/owner" : "/admin");
          return;
        }
        setUser(me.user);
      } catch {
        if (!alive) return;
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
        const [withdrawalRows, debtRows, adminRows] = await Promise.all([
          api.owner.withdrawals.list(),
          api.owner.debts.list(),
          api.owner.admins.list(),
        ]);

        const pendingWithdrawals = withdrawalRows.filter((row) => row.withdrawal.status === "pending" || row.withdrawal.status === "processed");
        if (pendingWithdrawals.length > 0) {
          items.push({
            id: "owner-withdrawals",
            title: `${pendingWithdrawals.length} withdrawal menunggu aksi`,
            description: "Ada request penarikan yang perlu dicek atau ditandai selesai.",
            href: "/owner/withdrawals",
            tone: "warning",
          });
        }

        const overdueDebts = debtRows.filter((row) => row.debt.status !== "paid" && isDebtOverdue(row.debt.dueDate));
        if (overdueDebts.length > 0) {
          items.push({
            id: "owner-overdue-debts",
            title: `${overdueDebts.length} piutang melewati jatuh tempo`,
            description: "Pantau risiko piutang lintas UMKM dari dashboard owner.",
            href: "/owner/debts",
            tone: "danger",
          });
        }

        const noQrisAdmins = adminRows.filter((row) => row.profile.isActive && !row.shop.qrisStaticImageUrl);
        if (noQrisAdmins.length > 0) {
          items.push({
            id: "owner-qris-static",
            title: `${noQrisAdmins.length} UMKM belum punya QRIS statis`,
            description: "Upload QRIS statis dari menu Admin Management agar pembayaran statis aktif.",
            href: "/owner/admins",
            tone: "info",
          });
        }
      } else {
        const [me, withdrawalRows, debtRows] = await Promise.all([
          api.me(),
          api.withdrawals.list(),
          api.debts.list(),
        ]);

        const activeDebts = debtRows.filter((debt) => debt.status !== "paid");
        if (activeDebts.length > 0) {
          items.push({
            id: "admin-active-debts",
            title: `${activeDebts.length} catatan hutang aktif`,
            description: "Masih ada pelanggan yang belum melunasi pembayaran.",
            href: "/admin/debts",
            tone: "warning",
          });
        }

        const pendingWithdrawals = withdrawalRows.filter((row) => row.status === "pending" || row.status === "processed");
        if (pendingWithdrawals.length > 0) {
          items.push({
            id: "admin-withdrawals",
            title: `${pendingWithdrawals.length} withdrawal sedang diproses`,
            description: "Cek status request penarikan saldo QRIS Pakasir.",
            href: "/admin/withdraw",
            tone: "info",
          });
        }

        const completedWithdrawals = withdrawalRows.filter((row) => row.status === "completed").slice(0, 1);
        if (completedWithdrawals.length > 0) {
          items.push({
            id: "admin-withdrawal-completed",
            title: "Withdrawal terakhir selesai",
            description: "Owner sudah menandai salah satu request penarikan sebagai selesai.",
            href: "/admin/withdraw",
            tone: "success",
          });
        }

        if (me.shop && !me.shop.qrisStaticImageUrl) {
          items.push({
            id: "admin-qris-static",
            title: "QRIS statis belum tersedia",
            description: "Minta Owner upload QRIS statis untuk UMKM ini dari Admin Management.",
            href: "/admin/pos",
            tone: "info",
          });
        }
      }

      setNotifications(items);
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
    router.replace("/login");
    router.refresh();
  }

  if (checking || sessionState.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f9ff] p-6 text-[#0b1c30]">
        <div className="rounded-3xl border border-[#bccac0] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-primary" />
          <p className="text-lg font-extrabold">KasirKita</p>
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
            <div className="flex items-center gap-3">
              <img src="/kasirkita-mark.png" alt="Logo KasirKita" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-primary">KasirKita</h1>
              </div>
            </div>
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
                <span>{item.label}</span>
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
                <p className="truncate text-xs text-[#3d4a42]">{role === "owner" ? "Owner Account" : user?.shopName || "Admin UMKM"}</p>
              </div>
            </div>
            <button onClick={signOut} className="mt-4 flex items-center gap-2 text-xs font-bold text-primary">
              <LogOut className="h-3.5 w-3.5" /> Logout
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
              <Link href={role === "owner" ? "/owner" : "/admin"} className="flex items-center gap-3">
                <img src="/kasirkita-mark.png" alt="Logo KasirKita" className="h-11 w-11 object-contain" />
                <span className="text-2xl font-black tracking-tight text-primary">KasirKita</span>
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
              Menu {role === "owner" ? "Owner" : "Admin"}
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
                    <span>{item.label}</span>
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
                    <p className="truncate text-xs text-[#3d4a42]">{role === "owner" ? "Owner Account" : user?.shopName || "Admin UMKM"}</p>
                  </div>
                </div>
                <button onClick={signOut} className="mt-4 flex items-center gap-2 text-sm font-bold text-primary">
                  <LogOut className="h-4 w-4" /> Logout
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
              <Link href={role === "owner" ? "/owner" : "/admin"} className="flex items-center gap-1 text-lg font-black text-primary">
                <img src="/kasirkita-mark.png" alt="KasirKita" className="h-8 w-8 object-contain" />
                <span>KK</span>
              </Link>
            </div>
            <div className="hidden w-full max-w-[440px] items-center rounded-2xl bg-[#e5eeff] px-4 py-2.5 text-sm text-[#3d4a42] md:flex">
              <Menu className="mr-2 h-5 w-5" /> {role === "owner" ? "Area Owner" : user?.shopName || "Area Admin"}
            </div>
            <div className="hidden border-l border-[#bccac0] pl-4 text-sm md:block">
              <p className="uppercase tracking-[0.16em] text-[#3d4a42]">Login sebagai</p>
              <p className="font-bold text-primary">{role === "owner" ? "Owner" : "Admin"}</p>
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
                      Semua transaksi, withdrawal, dan catatan penting sedang aman.
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

            <div className="hidden items-center gap-2 rounded-full bg-[#dae2fd] px-4 py-2 text-sm font-bold text-[#5c647a] sm:flex">
              <DollarSign className="h-4 w-4" /> API Connected
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
                      <p className="truncate text-xs text-[#3d4a42]">
                        {role === "owner" ? "Owner Account" : user?.shopName || "Admin UMKM"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-3">
                  <button
                    onClick={openProfileModal}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-[#0b1c30] transition hover:bg-[#eff4ff]"
                  >
                    <UserRound className="h-4 w-4 text-primary" />
                    Profil & Password
                  </button>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-red-700 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
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
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
              {description ? <p className="mt-1 text-base text-[#3d4a42]">{description}</p> : null}
            </div>
            {children}
          </div>
        )}
      </main>

      <Modal
        open={profileModalOpen}
        title="Profil Akun"
        description={role === "owner" ? "Kelola nama Owner, nama aplikasi/UMKM, dan password." : "Kelola nama admin, nama UMKM, dan password login."}
        onClose={() => setProfileModalOpen(false)}
      >
        <form onSubmit={saveProfile} className="space-y-5">
          {profileError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{profileError}</p> : null}
          {profileSuccess ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{profileSuccess}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profileName">{role === "owner" ? "Nama Owner" : "Nama Admin"}</Label>
              <Input
                id="profileName"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                minLength={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileShopName">Nama UMKM</Label>
              <Input
                id="profileShopName"
                value={profileShopName}
                onChange={(event) => setProfileShopName(event.target.value)}
                minLength={2}
                required
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#bccac0] bg-[#f8f9ff] p-4">
            <div className="mb-4 flex items-center gap-2 font-extrabold text-[#0b1c30]">
              <KeyRound className="h-4 w-4 text-primary" />
              Ganti Password
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password Lama</Label>
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
                  <Label htmlFor="newPassword">Password Baru</Label>
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
                  <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
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
