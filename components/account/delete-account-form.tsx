"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { clearCachedSession } from "@/lib/offline-session";
import { clearOfflineData, readOfflineCheckouts } from "@/lib/offline-pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (readOfflineCheckouts().length > 0) {
      setError("Masih ada transaksi offline yang belum tersinkron. Sinkronkan sebelum menghapus akun.");
      return;
    }
    if (!window.confirm("Akun, toko, kasir, produk, dan seluruh riwayat transaksi akan dihapus permanen. Lanjutkan?")) return;
    setLoading(true);
    try {
      await apiFetch("/api/account/delete", { method: "DELETE", body: JSON.stringify({ password, confirmation }) });
      clearCachedSession();
      await clearOfflineData();
      router.replace("/login?accountDeleted=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Penghapusan akun gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
      <div className="rounded-xl bg-red-50 p-4 text-sm leading-relaxed text-red-800">
        Tindakan ini permanen. Akun admin, akun kasir, toko, produk, transaksi, hutang, shift, dan data langganan terkait akan dihapus.
      </div>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="delete-password">Password saat ini</Label>
        <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="delete-confirmation">Ketik HAPUS</Label>
        <Input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={loading || confirmation.toUpperCase() !== "HAPUS"} className="bg-red-600 hover:bg-red-700">
          {loading ? "Menghapus..." : "Hapus akun permanen"}
        </Button>
        <Link href="/admin" className="inline-flex h-10 items-center justify-center rounded-lg border border-[#007a55] bg-white px-4 text-sm font-bold text-primary shadow-sm hover:bg-primary/5">Batal</Link>
      </div>
    </form>
  );
}
