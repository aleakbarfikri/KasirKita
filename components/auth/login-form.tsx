"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function roleHome(role?: "owner" | "admin") {
  return role === "owner" ? "/owner" : "/admin";
}

function resolveNext(next: string | null, role?: "owner" | "admin") {
  // Jangan redirect ke / dari halaman login karena / adalah protected landing yang bisa membuat loop
  // di Vercel preview setelah cookie/session berubah. Masuk langsung ke dashboard role.
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
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        router.replace(resolveNext(next, me.user.role));
      })
      .catch(() => {
        if (!alive) return;
        window.clearTimeout(timer);
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
      const result = await authClient.signIn.username({ username, password });
      if (result.error) {
        setError(result.error.message ?? "Login gagal");
        return;
      }

      const me = await api.me();
      router.push(resolveNext(next, me.user.role));
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <Card className="mx-auto w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl">
        <CardContent className="p-8 text-center">
          <p className="font-bold text-slate-950">Memeriksa sesi login...</p>
          <p className="mt-2 text-sm text-slate-500">Tunggu sebentar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl text-slate-950">Masuk KasirKita</CardTitle>
        <p className="text-sm text-slate-500">Masuk sebagai Owner atau Admin UMKM.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </div>
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Memproses..." : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
