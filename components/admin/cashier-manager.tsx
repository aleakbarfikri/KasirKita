"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { api, type CashierRow } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppLanguage } from "@/lib/i18n";

function normalizeUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function statusBadge(row: CashierRow, t: (text: string) => string) {
  if (row.profile.approvalStatus === "approved" && row.profile.isActive) return <Badge variant="success">{t("Aktif")}</Badge>;
  if (row.profile.approvalStatus === "pending") return <Badge variant="warning">{t("Menunggu Owner")}</Badge>;
  return <Badge variant="secondary">{t("Tidak Aktif")}</Badge>;
}

export function CashierManager() {
  const { t } = useAppLanguage();
  const [rows, setRows] = useState<CashierRow[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState<CashierRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function loadCashiers() {
    setLoading(true);
    setError(null);
    try {
      setRows(await api.cashiers.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat kasir");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCashiers();
  }, []);

  async function createCashier() {
    const normalizedUsername = normalizeUsername(username);
    if (!name.trim() || !normalizedUsername || !email.trim() || !password) {
      setError("Nama, username, email, dan password kasir wajib diisi.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.cashiers.create({
        name: name.trim(),
        username: normalizedUsername,
        email: email.trim(),
        password,
      });
      setRows((current) => [created, ...current]);
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setMessage(created.profile.approvalStatus === "approved" ? "Kasir berhasil dibuat dan langsung aktif." : "Kasir berhasil dibuat dan menunggu approval owner.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kasir");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (!editingPassword) return;
    if (newPassword.length < 8) {
      setPasswordError("Password kasir minimal 8 karakter.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setMessage(null);
    try {
      const updated = await api.cashiers.updatePassword(editingPassword.cashier.id, { password: newPassword });
      setRows((current) => current.map((row) => row.cashier.id === updated.cashier.id ? updated : row));
      setEditingPassword(null);
      setNewPassword("");
      setMessage("Password kasir berhasil diubah.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Gagal mengubah password kasir");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t("Tambah Akun Kasir")}</CardTitle>
          <CardDescription>{t("Kasir pertama langsung aktif. Kasir kedua dan seterusnya perlu approval owner.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          <div className="space-y-2"><Label>{t("Nama Kasir")}</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Budi Kasir" /></div>
          <div className="space-y-2"><Label>{t("Username")}</Label><Input value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} placeholder="kasir_budi" /></div>
          <div className="space-y-2"><Label>{t("Email")}</Label><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="kasir@example.com" /></div>
          <div className="space-y-2"><Label>{t("Password Awal")}</Label><Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={t("minimal 8 karakter")} /></div>
          <Button className="w-full" onClick={createCashier} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {t("Buat Kasir")}</Button>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>{t("Daftar Kasir")}</CardTitle>
              <CardDescription>{t("Kasir hanya dapat login ke POS dan Transaction History.")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadCashiers} className="w-full sm:w-auto"><RefreshCw className="mr-2 h-4 w-4" /> {t("Refresh")}</Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat kasir...")}</div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rows.map((row) => (
                  <div key={row.cashier.id} className="rounded-2xl border border-[#bccac0] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-[#0b1c30]">{row.cashier.name}</p>
                        <p className="truncate text-xs text-[#3d4a42]">{row.cashier.email}</p>
                        <p className="mt-2 truncate text-sm font-semibold text-[#0b1c30]">@{row.cashier.username}</p>
                      </div>
                      <div className="shrink-0">{statusBadge(row, t)}</div>
                    </div>
                    <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => { setEditingPassword(row); setNewPassword(""); setPasswordError(null); }}>
                      <KeyRound className="mr-2 h-4 w-4" /> {t("Ubah Password")}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>{t("Kasir")}</TableHead><TableHead>{t("Username")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead>{t("Aksi")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.cashier.id}>
                        <TableCell><p className="font-bold">{row.cashier.name}</p><p className="text-xs text-[#3d4a42]">{row.cashier.email}</p></TableCell>
                        <TableCell>{row.cashier.username}</TableCell>
                        <TableCell>{statusBadge(row, t)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => { setEditingPassword(row); setNewPassword(""); setPasswordError(null); }}>
                            <KeyRound className="mr-2 h-4 w-4" /> {t("Ubah Password")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Modal open={editingPassword !== null} title={t("Ubah Password Kasir")} description={t("Password baru langsung dipakai kasir untuk login berikutnya.")} onClose={() => !passwordSaving ? setEditingPassword(null) : undefined}>
        <div className="space-y-4">
          {passwordError ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{passwordError}</p> : null}
          <div className="rounded-2xl bg-[#eff4ff] p-4 text-sm">
            <p className="font-bold">{editingPassword?.cashier.name}</p>
            <p className="text-[#3d4a42]">{t("Username")}: {editingPassword?.cashier.username}</p>
          </div>
          <div className="space-y-2"><Label>{t("Password Baru")}</Label><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t("minimal 8 karakter")} /></div>
          <Button className="w-full" onClick={savePassword} disabled={passwordSaving}>{passwordSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {t("Simpan Password")}</Button>
        </div>
      </Modal>
    </div>
  );
}
