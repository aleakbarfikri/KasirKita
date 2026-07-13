"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setMessage("Password berhasil diubah. Semua sesi lama sudah dicabut. Silakan login kembali.");
      setCode(""); setPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal membuat password baru."); }
    finally { setLoading(false); }
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl">
      <CardHeader><CardTitle className="text-2xl text-slate-950">Pulihkan akun KasirKita</CardTitle><p className="text-sm text-slate-500">Kode pemulihan berlaku 10 menit.</p></CardHeader>
      <CardContent>
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="reset-email">Email akun</Label><Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <Button type="button" variant="outline" className="w-full" onClick={requestCode} disabled={loading || !email}>{loading ? "Memproses..." : codeSent ? "Kirim ulang kode" : "Kirim kode pemulihan"}</Button>
          {codeSent ? <><div className="space-y-2"><Label htmlFor="reset-code">Kode 6 angka</Label><Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></div><div className="space-y-2"><Label htmlFor="reset-password">Password baru</Label><Input id="reset-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="minimal 12 karakter" required /></div><Button type="submit" className="w-full" disabled={loading || code.length !== 6 || password.length < 12}>Simpan password baru</Button></> : null}
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
          <p className="text-center text-sm"><Link href="/login" className="font-bold text-primary">Kembali ke login</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}
