"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Copy, Loader2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MfaStatus = { enabled: boolean; recoveryCodesRemaining: number };
type SetupResult = { secret: string; uri: string; qrImageDataUrl: string };

export function OwnerMfaCard() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStatus() {
    try {
      setStatus(await apiFetch<MfaStatus>("/api/owner/mfa"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status MFA.");
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function startSetup() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setSetup(await apiFetch<SetupResult>("/api/owner/mfa/setup", { method: "POST", body: JSON.stringify({ currentPassword: password }) }));
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai setup MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ enabled: boolean; recoveryCodes: string[] }>("/api/owner/mfa/confirm", { method: "POST", body: JSON.stringify({ code }) });
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setCode("");
      setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length });
      setMessage("MFA Owner aktif. Simpan recovery code di tempat aman; kode hanya ditampilkan sekali.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kode authenticator tidak valid.");
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ disabled: boolean }>("/api/owner/mfa", { method: "DELETE", body: JSON.stringify({ currentPassword: password, code }) });
      window.location.href = "/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menonaktifkan MFA.");
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setMessage("Recovery code disalin.");
  }

  return (
    <Card className="bg-white">
      <CardHeader className="border-b border-[#e2e8f0]">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> MFA Owner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        {status === null ? <p className="text-sm text-slate-500">Memuat status...</p> : null}

        {status && !status.enabled && !setup ? (
          <>
            <p className="text-sm text-slate-600">Tambahkan kode authenticator saat login Owner.</p>
            <Label>Password Owner</Label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            <Button className="w-full" onClick={startSetup} disabled={busy || !password}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Aktifkan MFA</Button>
          </>
        ) : null}

        {setup ? (
          <>
            <p className="text-sm text-slate-600">Scan QR berikut dengan Google Authenticator, Microsoft Authenticator, 1Password, atau aplikasi TOTP lain.</p>
            <Image src={setup.qrImageDataUrl} alt="QR setup MFA Owner" width={240} height={240} unoptimized className="mx-auto rounded-xl border" />
            <p className="break-all rounded-xl bg-slate-50 p-3 text-center font-mono text-xs">{setup.secret}</p>
            <Label>Kode 6 digit</Label>
            <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            <Button className="w-full" onClick={confirmSetup} disabled={busy || code.length !== 6}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Verifikasi & Aktifkan</Button>
          </>
        ) : null}

        {status?.enabled && recoveryCodes.length === 0 ? (
          <>
            <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">MFA aktif · {status.recoveryCodesRemaining} recovery code tersisa.</p>
            <Label>Password Owner untuk menonaktifkan</Label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            <Label>Kode MFA / recovery code</Label>
            <Input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" />
            <Button className="w-full" variant="outline" onClick={disableMfa} disabled={busy || !password || !code}>Nonaktifkan MFA</Button>
          </>
        ) : null}

        {recoveryCodes.length ? (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">Simpan sekarang—tidak dapat dilihat lagi.</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">{recoveryCodes.map((recoveryCode) => <span key={recoveryCode}>{recoveryCode}</span>)}</div>
            <Button className="w-full" variant="outline" onClick={copyRecoveryCodes}><Copy className="mr-2 h-4 w-4" />Salin recovery code</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
