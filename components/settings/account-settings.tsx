"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Bluetooth, Copy, ExternalLink, KeyRound, Loader2, MailCheck, Printer, Save, ShieldCheck, Store, UserRound } from "lucide-react";
import { api, type MeResponse } from "@/lib/api-client";
import { OwnerMfaCard } from "@/components/dashboard/owner-mfa-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppLanguage } from "@/lib/i18n";
import { authorizeAndTestThermalPrinter, isBluetoothChooserCancelled } from "@/lib/thermal-bluetooth";

type Tab = "profile" | "email" | "password" | "security" | "receipt" | "online-store";

function storeSlug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export function AccountSettings({ role }: { role: "owner" | "admin" }) {
  const { t } = useAppLanguage();
  const [tab, setTab] = useState<Tab>("profile");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [onlineStoreSlug, setOnlineStoreSlug] = useState("");
  const [onlineStoreOpen, setOnlineStoreOpen] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [receipt, setReceipt] = useState({ paperWidth: "58mm" as "58mm"|"80mm", logoDataUrl: "" as string|null, printCopies: 1 as 1|2, showQueueNumber: false, autoPrint: false });

  useEffect(() => {
    api.me().then((result) => {
      setMe(result);
      setName(result.user.name || "");
      setShopName(result.shop?.name || result.user.shopName || "");
      setShopAddress(result.shop?.address || "");
      setShopPhone(result.shop?.phone || "");
      setOnlineStoreSlug(result.shop?.onlineStoreSlug || storeSlug(result.shop?.name || result.user.shopName || "toko-online"));
      setOnlineStoreOpen(result.shop?.onlineStoreOpen !== false);
      setNewEmail(result.user.email || "");
    }).catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat pengaturan."));
  }, []);
  useEffect(() => { if (role === "admin") api.receiptSettings.get().then((r) => setReceipt({ ...r, logoDataUrl: r.logoDataUrl || "" })).catch(()=>{}); }, [role]);

  function resetMessage() { setError(null); setSuccess(null); }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); resetMessage(); setBusy(true);
    try {
      const result = await api.profile.update({ name, shopName, shopAddress, shopPhone });
      setMe((current) => current ? { ...current, user: result.user, shop: result.shop ?? current.shop } : current);
      setSuccess("Profil dan informasi toko berhasil diperbarui.");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal menyimpan profil."); }
    finally { setBusy(false); }
  }

  async function sendEmailCode() {
    resetMessage();
    if (!emailPassword) return setError("Masukkan password saat ini sebelum meminta kode.");
    setBusy(true);
    try {
      await api.profile.requestEmailCode({ email: newEmail.trim(), currentPassword: emailPassword });
      setCodeSent(true);
      setSuccess(`Kode OTP telah diterima layanan email dan dikirim ke ${newEmail.trim()}. Periksa Inbox, Spam, dan Promotions.`);
    } catch (err) { setCodeSent(false); setError(err instanceof Error ? err.message : "Kode OTP gagal dikirim."); }
    finally { setBusy(false); }
  }

  async function confirmEmail(event: FormEvent) {
    event.preventDefault(); resetMessage();
    if (!codeSent) return setError("Kirim kode OTP terlebih dahulu.");
    setBusy(true);
    try {
      const result = await api.profile.confirmEmail({ email: newEmail.trim(), code: emailCode, currentPassword: emailPassword });
      setMe((current) => current ? { ...current, user: result.user } : current);
      setEmailPassword(""); setEmailCode(""); setCodeSent(false);
      setSuccess("Email berhasil diverifikasi dan diperbarui.");
    } catch (err) { setError(err instanceof Error ? err.message : "Verifikasi email gagal."); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); resetMessage();
    if (newPassword !== confirmPassword) return setError("Konfirmasi password baru tidak sama.");
    setBusy(true);
    try {
      await api.profile.update({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setSuccess("Password berhasil diperbarui. Sesi lain telah dicabut.");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal mengubah password."); }
    finally { setBusy(false); }
  }
  async function saveReceipt() { resetMessage(); setBusy(true); try { await api.receiptSettings.update(receipt); setSuccess("Pengaturan struk berhasil disimpan."); } catch(e){ setError(e instanceof Error?e.message:"Gagal menyimpan struk."); } finally { setBusy(false); } }
  async function saveOnlineStore() { resetMessage(); setBusy(true); try { const result = await api.profile.update({ onlineStoreSlug, onlineStoreOpen }); setMe((current) => current ? { ...current, shop: result.shop ?? current.shop } : current); setSuccess(t("Pengaturan toko online berhasil disimpan.")); } catch(e){ setError(e instanceof Error?e.message:t("Gagal menyimpan pengaturan toko online.")); } finally { setBusy(false); } }
  async function toggleOnlineStore() {
    resetMessage();
    const nextOpen = !onlineStoreOpen;
    setBusy(true);
    try {
      const result = await api.profile.update({ onlineStoreSlug, onlineStoreOpen: nextOpen });
      setOnlineStoreOpen(nextOpen);
      setMe((current) => current ? { ...current, shop: result.shop ?? current.shop } : current);
      setSuccess(t(nextOpen ? "Toko online berhasil dibuka." : "Toko online berhasil ditutup. Customer tidak dapat melakukan pembayaran."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Gagal mengubah status toko online."));
    } finally { setBusy(false); }
  }
  async function testBluetooth() { try { resetMessage(); setBusy(true); const name=await authorizeAndTestThermalPrinter(); setSuccess(`Printer ${name} terhubung dan tes cetak berhasil. Auto-print akan memakai printer ini.`); } catch(e){ if(isBluetoothChooserCancelled(e)){ setError(null); return; } setError(e instanceof Error?e.message:"Printer tidak terhubung."); } finally { setBusy(false); } }

  const tabs = [
    { id: "profile" as const, label: "Edit Profil", icon: UserRound },
    { id: "email" as const, label: "Email & OTP", icon: MailCheck },
    { id: "password" as const, label: "Ubah Password", icon: KeyRound },
    { id: "security" as const, label: "Keamanan MFA", icon: ShieldCheck },
    ...(role === "admin" ? [{ id: "receipt" as const, label: "Pengaturan Struk", icon: Printer }] : []),
    ...(role === "admin" ? [{ id: "online-store" as const, label: "Pengaturan Toko Online", icon: Store }] : []),
  ];

  return <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
    <Card className="h-fit bg-white"><CardContent className="space-y-2 p-3 pt-3 sm:pt-3">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setTab(id); resetMessage(); }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-extrabold transition ${tab === id ? "bg-primary text-white shadow" : "text-slate-700 hover:bg-slate-50"}`}><Icon className="h-5 w-5" />{t(label)}</button>)}</CardContent></Card>
    <div className="min-w-0 space-y-4">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</p> : null}
      {!me ? <Card><CardContent className="flex min-h-20 items-center gap-2 p-6 pt-6 sm:pt-6"><Loader2 className="h-5 w-5 animate-spin" /> Memuat pengaturan...</CardContent></Card> : null}

      {me && tab === "profile" ? <Card className="bg-white"><CardHeader><CardTitle>Edit Profil dan Toko</CardTitle></CardHeader><CardContent><form onSubmit={saveProfile} className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Nama {role === "owner" ? "Owner" : "Admin"}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></div><div className="space-y-2"><Label>Nama UMKM/Platform</Label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} required minLength={2} /></div>{role === "admin" ? <><div className="space-y-2"><Label>Alamat Toko/UMKM</Label><Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} /></div><div className="space-y-2"><Label>Nomor Telepon</Label><Input type="tel" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} /></div></> : null}<Button className="sm:col-span-2" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Simpan Profil</Button></form></CardContent></Card> : null}

      {me && tab === "email" ? <Card className="bg-white"><CardHeader><CardTitle>Ubah dan Verifikasi Email</CardTitle></CardHeader><CardContent><form onSubmit={confirmEmail} className="space-y-5"><div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold">Email aktif</p><p className="mt-1 break-all text-slate-600">{me.user.email}</p></div><div className="space-y-2"><Label>Email baru</Label><Input type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setCodeSent(false); setEmailCode(""); }} required /></div><div className="space-y-2"><Label>Password saat ini</Label><Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} autoComplete="current-password" required /></div><Button type="button" variant="outline" className="w-full" onClick={sendEmailCode} disabled={busy || newEmail.trim().toLowerCase() === me.user.email.toLowerCase()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}{codeSent ? "Kirim Ulang Kode OTP" : "Kirim Kode OTP"}</Button><div className="space-y-2"><Label>Kode OTP 6 angka</Label><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))} placeholder={codeSent ? "Masukkan kode dari email" : "Kirim kode terlebih dahulu"} disabled={!codeSent} required /><p className="text-xs font-semibold text-slate-500">Kode berlaku 10 menit. Periksa folder Spam dan Promotions jika belum terlihat.</p></div><Button className="w-full" disabled={busy || !codeSent || emailCode.length !== 6}>Verifikasi & Simpan Email</Button></form></CardContent></Card> : null}

      {me && tab === "password" ? <Card className="bg-white"><CardHeader><CardTitle>Ubah Password</CardTitle></CardHeader><CardContent><form onSubmit={changePassword} className="space-y-5"><div className="space-y-2"><Label>Password saat ini</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Password baru</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></div><div className="space-y-2"><Label>Konfirmasi password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></div></div><p className="text-xs font-semibold text-slate-500">Gunakan minimal 12 karakter. Sesi login lain akan dicabut setelah password diganti.</p><Button className="w-full" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Ubah Password</Button></form></CardContent></Card> : null}

      {me && tab === "security" ? <div className="space-y-4"><OwnerMfaCard roleLabel={role === "owner" ? "Owner" : "Admin"} />{role === "admin" ? <Link href="/account/delete" className="inline-flex rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50">Penghapusan akun dan data</Link> : null}</div> : null}
      {me && tab === "receipt" ? (
        <Card className="bg-white">
          <CardHeader><CardTitle>{t("Pengaturan Struk")}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t("Ukuran kertas thermal")}</Label>
              <select className="h-11 w-full rounded-xl border px-3" value={receipt.paperWidth} onChange={(e) => setReceipt({ ...receipt, paperWidth: e.target.value as "58mm" | "80mm" })}>
                <option value="58mm">58mm</option><option value="80mm">80mm</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("Logo usaha")}</Label>
              <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-bold text-primary hover:bg-primary/5">
                {t("Pilih file logo")}
                <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => setReceipt({ ...receipt, logoDataUrl: String(reader.result) }); reader.readAsDataURL(f); }} />
              </label>
              {receipt.logoDataUrl ? <img src={receipt.logoDataUrl} alt={t("Pratinjau logo")} className="h-20 w-20 rounded-xl border object-contain" /> : null}
            </div>
            <label className="flex min-h-20 items-center justify-between rounded-xl border p-4 font-bold"><span>{t("Cetak 2 rangkap untuk pelanggan dan dapur")}</span><input type="checkbox" checked={receipt.printCopies === 2} onChange={(e) => setReceipt({ ...receipt, printCopies: e.target.checked ? 2 : 1 })} /></label>
            <label className="flex min-h-20 items-center justify-between rounded-xl border p-4 font-bold"><span>{t("Nomor antrean")}</span><input type="checkbox" checked={receipt.showQueueNumber} onChange={(e) => setReceipt({ ...receipt, showQueueNumber: e.target.checked })} /></label>
            <label className="flex min-h-20 items-center justify-between gap-4 rounded-xl border p-4">
              <span className="min-w-0">
                <span className="block font-bold">{t("Cetak otomatis setelah transaksi")}</span>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">{t("Printer harus pernah diizinkan melalui tombol koneksi Bluetooth.")}</span>
              </span>
              <input className="shrink-0" type="checkbox" checked={receipt.autoPrint} onChange={(e) => setReceipt({ ...receipt, autoPrint: e.target.checked })} />
            </label>
            <Button type="button" variant="outline" className="w-full" onClick={testBluetooth}><Bluetooth className="mr-2 h-4 w-4" />{t("Hubungkan dan tes printer Bluetooth")}</Button>
            <p className="text-xs text-slate-500">{t("Watermark KasirKita otomatis tidak dicetak untuk paket Pro dan Business.")}</p>
            <Button className="w-full" onClick={saveReceipt} disabled={busy}><Save className="mr-2 h-4 w-4" />{t("Simpan Pengaturan Struk")}</Button>
          </CardContent>
        </Card>
      ) : null}
      {me && tab === "online-store" ? (
        <Card className="bg-white">
          <CardHeader><CardTitle>{t("Pengaturan Toko Online")}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <label className="flex min-h-20 items-center justify-between gap-4 rounded-xl border p-4">
              <span><span className="block font-bold">{t("Status toko online")}</span><span className="mt-1 block text-xs text-slate-500">{onlineStoreOpen ? t("Customer dapat melihat produk dan membuat pesanan.") : t("Customer tidak dapat membuka toko atau checkout.")}</span></span>
              <button type="button" role="switch" aria-checked={onlineStoreOpen} disabled={busy || onlineStoreSlug.length < 3} onClick={toggleOnlineStore} className={`rounded-full px-5 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${onlineStoreOpen ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : onlineStoreOpen ? t("Toko Buka") : t("Toko Tutup")}</button>
            </label>
            <div className="space-y-2">
              <Label>{t("Link custom toko")}</Label>
              <div className="flex overflow-hidden rounded-xl border bg-white focus-within:ring-2 focus-within:ring-primary/20"><span className="flex items-center border-r bg-slate-50 px-3 text-sm text-slate-500">/store/</span><input className="h-11 min-w-0 flex-1 px-3 outline-none" value={onlineStoreSlug} onChange={(event) => setOnlineStoreSlug(storeSlug(event.target.value))} minLength={3} maxLength={50} placeholder="nama-toko" /></div>
              <p className="text-xs text-slate-500">{t("Gunakan 3-50 karakter: huruf kecil, angka, dan tanda hubung.")}</p>
            </div>
            <div className={`rounded-xl p-4 ${onlineStoreOpen ? "bg-slate-50" : "border border-slate-200 bg-slate-100 opacity-75"}`}><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("Alamat toko")}</p><span className={`rounded-full px-3 py-1 text-xs font-black ${onlineStoreOpen ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{t(onlineStoreOpen ? "Toko Buka" : "Toko Tutup")}</span></div><p className="mt-1 break-all font-bold">{typeof window !== "undefined" ? `${window.location.origin}/store/${onlineStoreSlug}` : `/store/${onlineStoreSlug}`}</p>{!onlineStoreOpen ? <p className="mt-2 text-xs font-semibold text-slate-600">{t("Link menampilkan status toko tutup dan pembayaran dinonaktifkan.")}</p> : null}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" disabled={onlineStoreSlug.length < 3} onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/store/${onlineStoreSlug}`); setSuccess(t("Link toko berhasil disalin.")); }}><Copy className="mr-2 h-4 w-4" />{t("Salin Link Toko")}</Button>
              <Button type="button" variant="outline" disabled={!onlineStoreOpen || onlineStoreSlug.length < 3} onClick={() => window.open(`/store/${onlineStoreSlug}`, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 h-4 w-4" />{t(onlineStoreOpen ? "Buka Toko Online" : "Toko Sedang Tutup")}</Button>
            </div>
            <Button className="w-full" onClick={saveOnlineStore} disabled={busy || onlineStoreSlug.length < 3}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t("Simpan Pengaturan Toko")}</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  </div>;
}
