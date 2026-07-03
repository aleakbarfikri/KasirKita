"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, type OwnerAdminRow } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function normalizeUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setSendingCode(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch<{ sent: boolean; expiresAt: string }>("/api/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email, shopName }),
      });
      setCodeSent(true);
      setMessage("Kode verifikasi sudah dikirim ke email. Cek inbox atau spam.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim kode verifikasi.");
    } finally {
      setSendingCode(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await apiFetch<OwnerAdminRow & { trialDays: number }>("/api/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          shopName,
          shopAddress,
          shopPhone,
          username: normalizeUsername(username),
          email,
          verificationCode,
          password,
        }),
      });
      setMessage(`Trial ${result.trialDays} hari aktif. Username login: ${result.admin.username}`);
      window.setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal daftar trial.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-2xl rounded-[2rem] border-slate-200 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-3xl text-slate-950">Daftar Trial KasirKita</CardTitle>
        <p className="text-sm text-slate-500">Coba gratis 14 hari. Setelah daftar, login sebagai admin UMKM.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nama Pemilik</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ayu Lestari" required />
          </div>
          <div className="space-y-2">
            <Label>Nama UMKM</Label>
            <Input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="Warung Sumber Rezeki" required />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} placeholder="warung_rezeki" required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@umkm.com" required />
          </div>
          <div className="space-y-2">
            <Label>Kode Verifikasi Email</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 angka" inputMode="numeric" required />
              <Button type="button" variant="outline" onClick={sendCode} disabled={sendingCode || !email || !shopName}>
                {sendingCode ? "Mengirim..." : codeSent ? "Kirim Ulang" : "Kirim Kode"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">Kode dikirim dari customercare@kasir-kita.com dan berlaku 10 menit.</p>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="minimal 8 karakter" required />
          </div>
          <div className="space-y-2">
            <Label>Nomor WhatsApp</Label>
            <Input value={shopPhone} onChange={(event) => setShopPhone(event.target.value)} placeholder="08xxxxxxxxxx" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Alamat Toko</Label>
            <Input value={shopAddress} onChange={(event) => setShopAddress(event.target.value)} placeholder="Jl. Melati No. 10" />
          </div>
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
          {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-2">{message}</p> : null}
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>{loading ? "Mendaftarkan..." : "Daftar Trial Gratis"}</Button>
            <Link href="/login" className="text-sm font-bold text-primary">Sudah punya akun? Login</Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
