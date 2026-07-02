"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaymentConfigForm() {
  const [slug, setSlug] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [whatsappProvider, setWhatsappProvider] = useState("");
  const [whatsappApiKey, setWhatsappApiKey] = useState("");
  const [whatsappSender, setWhatsappSender] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const config = await api.owner.paymentConfig.get();
      setSlug(config?.pakasirSlug ?? "");
      setApiKey(config?.pakasirApiKey ?? "");
      setWhatsappProvider(config?.whatsappProvider ?? "");
      setWhatsappApiKey(config?.whatsappApiKey ?? "");
      setWhatsappSender(config?.whatsappSender ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat konfigurasi Pakasir");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function saveConfig() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.owner.paymentConfig.save({
        pakasirSlug: slug.trim(),
        pakasirApiKey: apiKey.trim(),
        whatsappProvider: whatsappProvider.trim(),
        whatsappApiKey: whatsappApiKey.trim(),
        whatsappSender: whatsappSender.trim(),
      });
      setMessage("Konfigurasi Pakasir berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan konfigurasi Pakasir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi API Pakasir</CardTitle>
          <CardDescription>Simpan <b>slug</b> dan <b>API key</b> Pakasir untuk checkout QRIS dinamis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat konfigurasi...</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Slug Pakasir</Label>
                <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="contoh: kasirkita" autoCapitalize="none" autoCorrect="off" />
                <p className="text-xs text-[#3d4a42]">Isi dengan slug/identifier merchant dari akun Pakasir.</p>
              </div>
              <div className="space-y-2">
                <Label>API Key Pakasir</Label>
                <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="pk_live_xxxxxxxxx" autoCapitalize="none" autoCorrect="off" />
              </div>
              <div className="border-t border-[#bccac0] pt-4">
                <h3 className="font-extrabold text-[#0b1c30]">Konfigurasi WhatsApp Bot</h3>
                <p className="mt-1 text-xs text-[#3d4a42]">Opsional. Disimpan di akun owner untuk integrasi WA otomatis setelah provider dipilih.</p>
              </div>
              <div className="space-y-2">
                <Label>Provider WhatsApp</Label>
                <Input value={whatsappProvider} onChange={(event) => setWhatsappProvider(event.target.value)} placeholder="contoh: fonnte / wablas / custom" autoCapitalize="none" autoCorrect="off" />
              </div>
              <div className="space-y-2">
                <Label>API Key WhatsApp</Label>
                <Input value={whatsappApiKey} onChange={(event) => setWhatsappApiKey(event.target.value)} placeholder="token provider WhatsApp" autoCapitalize="none" autoCorrect="off" />
              </div>
              <div className="space-y-2">
                <Label>Sender / Device ID</Label>
                <Input value={whatsappSender} onChange={(event) => setWhatsappSender(event.target.value)} placeholder="opsional sesuai provider" autoCapitalize="none" autoCorrect="off" />
              </div>
              <Button className="w-full" onClick={saveConfig} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan Konfigurasi
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#213145] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5 text-emerald-200" /> QRIS Statis per Admin</CardTitle>
          <CardDescription className="text-white/70">QRIS statis tidak lagi diatur di halaman ini.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-white/80">
          <div className="rounded-3xl bg-white/10 p-4">
            <KeyRound className="mb-3 h-8 w-8 text-emerald-200" />
            <p className="font-semibold text-white">Atur QRIS statis dari menu Admin Management.</p>
            <p className="mt-2">Klik tombol <b>Edit</b> pada admin cabang, lalu upload gambar QRIS pemilik UMKM/cabang. QRIS tersebut langsung muncul di metode pembayaran QRIS Statis milik admin tersebut.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
