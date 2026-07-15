"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { cacheSession, readCachedSession } from "@/lib/offline-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";

function roleHome(role?: "owner" | "admin" | "cashier") {
  if (role === "cashier") return "/admin";
  return role === "owner" ? "/owner" : "/admin";
}

function resolveNext(next: string | null, role?: "owner" | "admin" | "cashier") {
  // Jangan redirect ke / dari halaman login karena / adalah protected landing yang bisa membuat loop
  // di Vercel preview setelah cookie/session berubah. Masuk langsung ke dashboard role.
  if (role === "cashier") {
    return "/admin";
  }
  if (!next || next === "/" || next.startsWith("/login")) return roleHome(role);
  if (role === "owner" && next.startsWith("/admin")) return "/owner";
  if (role === "admin" && next.startsWith("/owner")) return "/admin";
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaRole, setMfaRole] = useState<"owner" | "admin" | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mfaInputRef = useRef<HTMLInputElement | null>(null);
  const passwordReset = searchParams.get("passwordReset") === "1";

  useEffect(() => {
    if (mfaRequired) mfaInputRef.current?.focus();
  }, [mfaRequired]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      // Fallback supaya layar tidak stuck di "Memeriksa sesi login..." jika serverless
      // preview sedang cold start atau request /api/me tertahan.
      if (alive) setChecking(false);
    }, 5000);

    api.me()
      .then((me) => {
        if (!alive) return;
        window.clearTimeout(timer);
        cacheSession(me);
        router.replace(resolveNext(next, me.user.role));
      })
      .catch(() => {
        if (!alive) return;
        window.clearTimeout(timer);
        const cached = readCachedSession();
        if (cached?.user && !navigator.onLine) {
          router.replace(resolveNext(next, cached.user.role));
          return;
        }
        setChecking(false);
      });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [next, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.username({ username, password, mfaCode });
      if (result.error) {
        const details = result.error.details as { mfaRequired?: boolean; role?: "owner" | "admin" } | undefined;
        if (details?.mfaRequired) {
          setMfaRequired(true);
          setMfaRole(details.role ?? null);
          setError(mfaCode ? result.error.message : null);
          return;
        }
        setError(result.error.message ?? "Login gagal");
        return;
      }

      const me = await api.me();
      cacheSession(me);
      router.push(resolveNext(next, me.user.role));
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  function resetMfaStep() {
    setMfaRequired(false);
    setMfaRole(null);
    setMfaCode("");
    setPassword("");
    setError(null);
  }

  if (checking) {
    return (
      <Card className="mx-auto w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl">
        <CardContent className="flex min-h-32 flex-col items-center justify-center p-8 pt-8 text-center sm:pt-8">
          <p className="font-bold text-slate-950">Memeriksa sesi login...</p>
          <p className="mt-2 text-sm text-slate-500">Tunggu sebentar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl text-slate-950">Masuk Dashboard KasirKita</CardTitle>
        <p className="text-sm text-slate-500">Masuk sebagai owner, admin, atau kasir toko.</p>
      </CardHeader>
      <CardContent>
        {passwordReset ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="text-sm font-bold">Password berhasil diperbarui</p><p className="text-xs">Silakan masuk menggunakan password baru.</p></div>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          {!mfaRequired ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                <div className="text-right"><Link href="/forgot-password" className="text-xs font-bold text-primary">Lupa password?</Link></div>
              </div>
            </>
          ) : (
            <div className="kk-enter space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-700 p-2 text-white"><ShieldCheck className="h-5 w-5" /></div>
                <div><p className="font-black text-slate-950">Verifikasi dua langkah</p><p className="text-xs text-slate-600">Password benar. Masukkan kode authenticator atau recovery code {mfaRole === "owner" ? "Owner" : "akun"}.</p></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Kode MFA / recovery code</Label>
                <Input ref={mfaInputRef} id="mfaCode" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.trim())} inputMode="numeric" autoComplete="one-time-code" placeholder="6 digit atau recovery code" required />
              </div>
              <button type="button" onClick={resetMfaStep} className="text-xs font-bold text-primary">Masuk dengan akun lain</button>
            </div>
          )}
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading || (mfaRequired && !mfaCode)}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mfaRequired ? <KeyRound className="mr-2 h-4 w-4" /> : null}
            {loading ? (mfaRequired ? "Memverifikasi..." : "Memeriksa akun...") : mfaRequired ? "Verifikasi & masuk" : "Login"}
          </Button>
          <div className="text-center text-sm text-slate-500">
            Belum punya akun UMKM? <Link href="/register" className="font-bold text-primary">Daftar paket Free</Link>
          </div>
          <div className="text-center text-sm">
            <Link href="/pricing" className="font-bold text-primary">Lihat paket & harga</Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
