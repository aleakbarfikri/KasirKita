"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSucceeded, setResetSucceeded] = useState(false);

  useEffect(() => {
    if (!resetSucceeded) return;
    const timer = window.setTimeout(() => router.replace("/login?passwordReset=1"), 1800);
    return () => window.clearTimeout(timer);
  }, [resetSucceeded, router]);

  async function requestCode() {
    setLoading(true); setError(null); setMessage(null);
    try {
      await apiFetch("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
      setCodeSent(true);
      setMessage("Jika email terdaftar, kode pemulihan sudah dikirim. Periksa inbox dan spam.");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal meminta kode."); }
    finally { setLoading(false); }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null); setMessage(null);
    try {
      await apiFetch("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ email, verificationCode: code, password }) });
      setResetSucceeded(true);
      setMessage("Password berhasil diubah. Mengarahkan ke halaman login...");
      setCode(""); setPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal membuat password baru."); }
    finally { setLoading(false); }
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl">
      <CardHeader><CardTitle className="text-2xl text-slate-950">{resetSucceeded ? "Password berhasil diperbarui" : "Pulihkan akun KasirKita"}</CardTitle><p className="text-sm text-slate-500">{resetSucceeded ? "Anda akan kembali ke halaman login." : "Kode pemulihan berlaku 10 menit."}</p></CardHeader>
      <CardContent>
        {resetSucceeded ? (
          <div className="kk-enter py-8 text-center">
            <div className="mx-auto flex h-20 w-20 animate-bounce items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-11 w-11" /></div>
            <p className="mt-5 font-black text-slate-950">Password baru sudah aktif</p>
            <p className="mt-2 text-sm text-slate-500">Semua sesi lama telah dicabut demi keamanan.</p>
            <div className="mx-auto mt-6 flex items-center justify-center gap-2 text-sm font-bold text-primary"><Loader2 className="h-4 w-4 animate-spin" /> Membuka halaman login...</div>
          </div>
        ) : <form onSubmit={resetPassword} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="reset-email">Email akun</Label><Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <Button type="button" variant="outline" className="w-full" onClick={requestCode} disabled={loading || !email}>{loading ? "Memproses..." : codeSent ? "Kirim ulang kode" : "Kirim kode pemulihan"}</Button>
          {codeSent ? <><div className="space-y-2"><Label htmlFor="reset-code">Kode 6 angka</Label><Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></div><div className="space-y-2"><Label htmlFor="reset-password">Password baru</Label><Input id="reset-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="minimal 12 karakter" required /></div><Button type="submit" className="w-full" disabled={loading || code.length !== 6 || password.length < 12}>Simpan password baru</Button></> : null}
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
          <p className="text-center text-sm"><Link href="/login" className="font-bold text-primary">Kembali ke login</Link></p>
        </form>}
      </CardContent>
    </Card>
  );
}
