"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Bluetooth, KeyRound, Loader2, MailCheck, Printer, Save, ShieldCheck, UserRound } from "lucide-react";
import { api, type MeResponse } from "@/lib/api-client";
import { OwnerMfaCard } from "@/components/dashboard/owner-mfa-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tab = "profile" | "email" | "password" | "security" | "receipt";

export function AccountSettings({ role }: { role: "owner" | "admin" }) {
  const [tab, setTab] = useState<Tab>("profile");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
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
  async function testBluetooth() { try { const bt=(navigator as Navigator & {bluetooth?:{requestDevice:(o:unknown)=>Promise<{name?:string}>}}).bluetooth; if(!bt) throw new Error("Bluetooth printer membutuhkan Chrome/Edge desktop atau Android."); const device=await bt.requestDevice({acceptAllDevices:true,optionalServices:["generic_access"]}); setSuccess(`Printer ${device.name || "Bluetooth"} dipilih. Browser akan meminta koneksi lagi saat print.`); } catch(e){ setError(e instanceof Error?e.message:"Printer tidak terhubung."); } }

  const tabs = [
    { id: "profile" as const, label: "Edit Profil", icon: UserRound },
    { id: "email" as const, label: "Email & OTP", icon: MailCheck },
    { id: "password" as const, label: "Ubah Password", icon: KeyRound },
    { id: "security" as const, label: "Keamanan MFA", icon: ShieldCheck },
    ...(role === "admin" ? [{ id: "receipt" as const, label: "Pengaturan Struk", icon: Printer }] : []),
  ];

  return <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
    <Card className="h-fit bg-white"><CardContent className="space-y-2 p-3">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setTab(id); resetMessage(); }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-extrabold transition ${tab === id ? "bg-primary text-white shadow" : "text-slate-700 hover:bg-slate-50"}`}><Icon className="h-5 w-5" />{label}</button>)}</CardContent></Card>
    <div className="min-w-0 space-y-4">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</p> : null}
      {!me ? <Card><CardContent className="flex items-center gap-2 p-6"><Loader2 className="h-5 w-5 animate-spin" /> Memuat pengaturan...</CardContent></Card> : null}

      {me && tab === "profile" ? <Card className="bg-white"><CardHeader><CardTitle>Edit Profil dan Toko</CardTitle></CardHeader><CardContent><form onSubmit={saveProfile} className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Nama {role === "owner" ? "Owner" : "Admin"}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></div><div className="space-y-2"><Label>Nama UMKM/Platform</Label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} required minLength={2} /></div>{role === "admin" ? <><div className="space-y-2"><Label>Alamat Toko/UMKM</Label><Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} /></div><div className="space-y-2"><Label>Nomor Telepon</Label><Input type="tel" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} /></div></> : null}<Button className="sm:col-span-2" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Simpan Profil</Button></form></CardContent></Card> : null}

      {me && tab === "email" ? <Card className="bg-white"><CardHeader><CardTitle>Ubah dan Verifikasi Email</CardTitle></CardHeader><CardContent><form onSubmit={confirmEmail} className="space-y-5"><div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold">Email aktif</p><p className="mt-1 break-all text-slate-600">{me.user.email}</p></div><div className="space-y-2"><Label>Email baru</Label><Input type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setCodeSent(false); setEmailCode(""); }} required /></div><div className="space-y-2"><Label>Password saat ini</Label><Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} autoComplete="current-password" required /></div><Button type="button" variant="outline" className="w-full" onClick={sendEmailCode} disabled={busy || newEmail.trim().toLowerCase() === me.user.email.toLowerCase()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}{codeSent ? "Kirim Ulang Kode OTP" : "Kirim Kode OTP"}</Button><div className="space-y-2"><Label>Kode OTP 6 angka</Label><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))} placeholder={codeSent ? "Masukkan kode dari email" : "Kirim kode terlebih dahulu"} disabled={!codeSent} required /><p className="text-xs font-semibold text-slate-500">Kode berlaku 10 menit. Periksa folder Spam dan Promotions jika belum terlihat.</p></div><Button className="w-full" disabled={busy || !codeSent || emailCode.length !== 6}>Verifikasi & Simpan Email</Button></form></CardContent></Card> : null}

      {me && tab === "password" ? <Card className="bg-white"><CardHeader><CardTitle>Ubah Password</CardTitle></CardHeader><CardContent><form onSubmit={changePassword} className="space-y-5"><div className="space-y-2"><Label>Password saat ini</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Password baru</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></div><div className="space-y-2"><Label>Konfirmasi password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></div></div><p className="text-xs font-semibold text-slate-500">Gunakan minimal 12 karakter. Sesi login lain akan dicabut setelah password diganti.</p><Button className="w-full" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Ubah Password</Button></form></CardContent></Card> : null}

      {me && tab === "security" ? <div className="space-y-4"><OwnerMfaCard roleLabel={role === "owner" ? "Owner" : "Admin"} />{role === "admin" ? <Link href="/account/delete" className="inline-flex rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50">Penghapusan akun dan data</Link> : null}</div> : null}
      {me && tab === "receipt" ? <Card className="bg-white"><CardHeader><CardTitle>Pengaturan Struk / Receipt Settings</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Ukuran thermal / Paper width</Label><select className="h-11 w-full rounded-xl border px-3" value={receipt.paperWidth} onChange={(e)=>setReceipt({...receipt,paperWidth:e.target.value as "58mm"|"80mm"})}><option value="58mm">58mm</option><option value="80mm">80mm</option></select></div><div className="space-y-2"><Label>Logo usaha / Business logo</Label><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>setReceipt({...receipt,logoDataUrl:String(reader.result)});reader.readAsDataURL(f);}} />{receipt.logoDataUrl?<img src={receipt.logoDataUrl} alt="Logo preview" className="h-20 w-20 rounded-xl border object-contain"/>:null}</div><label className="flex items-center justify-between rounded-xl border p-4 font-bold"><span>Print 2 rangkap / Customer + Kitchen</span><input type="checkbox" checked={receipt.printCopies===2} onChange={(e)=>setReceipt({...receipt,printCopies:e.target.checked?2:1})}/></label><label className="flex items-center justify-between rounded-xl border p-4 font-bold"><span>Nomor antrean / Queue number</span><input type="checkbox" checked={receipt.showQueueNumber} onChange={(e)=>setReceipt({...receipt,showQueueNumber:e.target.checked})}/></label><Button type="button" variant="outline" className="w-full" onClick={testBluetooth}><Bluetooth className="mr-2 h-4 w-4"/>Hubungkan/Test Printer Bluetooth</Button><p className="text-xs text-slate-500">Watermark KasirKita otomatis tidak dicetak untuk paket Pro dan Business.</p><Button className="w-full" onClick={saveReceipt} disabled={busy}><Save className="mr-2 h-4 w-4"/>Simpan Pengaturan Struk</Button></CardContent></Card>:null}
      {me && tab === "receipt" ? <Card className="bg-white"><CardContent className="p-5"><label className="flex items-center justify-between gap-4 font-bold"><span>Auto print setelah transaksi / Auto print after checkout</span><input type="checkbox" checked={receipt.autoPrint} onChange={(e)=>setReceipt({...receipt,autoPrint:e.target.checked})}/></label><p className="mt-2 text-xs text-slate-500">Printer harus pernah diizinkan melalui tombol koneksi Bluetooth.</p></CardContent></Card> : null}
    </div>
  </div>;
}
