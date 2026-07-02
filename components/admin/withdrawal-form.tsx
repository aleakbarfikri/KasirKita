"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, KeyRound, Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { api, withdrawalStatusLabel, type TransactionRecord, type WithdrawalRecord } from "@/lib/api-client";
import { formatCurrency, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { useAppLanguage } from "@/lib/i18n";

function statusVariant(status: WithdrawalRecord["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "processed") return "secondary" as const;
  return "danger" as const;
}

export function WithdrawalForm() {
  const { t } = useAppLanguage();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [bankName, setBankName] = useState("BCA");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [withdrawalRows, transactionRows] = await Promise.all([api.withdrawals.list(), api.transactions.list()]);
      setWithdrawals(withdrawalRows);
      setTransactions(transactionRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data withdrawal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const earnedQris = transactions.filter((row) => row.paymentMethod === "qris_pakasir" && row.status === "success").reduce((sum, row) => sum + row.total, 0);
  const reserved = withdrawals.filter((row) => row.status === "pending" || row.status === "processed").reduce((sum, row) => sum + row.amount, 0);
  const withdrawn = withdrawals.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.amount, 0);
  const availableBalance = Math.max(earnedQris - reserved - withdrawn, 0);

  const amountNumber = Number(amount || 0);
  const invalid = amountNumber > availableBalance;
  const canSubmit = amountNumber > 0 && !invalid && accountNumber.length >= 3 && accountName.length >= 2;

  const helper = useMemo(() => {
    if (!amount) return t("Masukkan jumlah penarikan dari saldo QRIS Pakasir.");
    if (invalid) return t("Jumlah tidak boleh melebihi saldo digital tersedia.");
    return t("Request akan muncul di dashboard Owner.");
  }, [amount, invalid, t]);

  function submitWithdrawal() {
    if (!canSubmit) return;
    setError(null);
    setPasswordError(null);
    setPasswordModalOpen(true);
    setAdminPassword("");
  }

  async function confirmWithdrawal() {
    if (!canSubmit || !adminPassword.trim()) {
      setPasswordError("Masukkan password admin untuk konfirmasi penarikan.");
      return;
    }
    setSaving(true);
    setError(null);
    setPasswordError(null);
    setMessage(null);
    try {
      const created = await api.withdrawals.create({ amount: amountNumber, bankName, accountNumber, accountName, adminPassword });
      setWithdrawals((current) => [created, ...current]);
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      setAdminPassword("");
      setPasswordError(null);
      setPasswordModalOpen(false);
      setMessage("Request penarikan berhasil dikirim ke Owner.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Gagal mengajukan penarikan";
      setPasswordError(errorMessage.includes("Password") || errorMessage.includes("password") || errorMessage.includes("Unauthorized") ? "Password admin salah. Silakan cek kembali password akun yang sedang login." : errorMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t("Ajukan Tarik Dana")}</CardTitle>
          <CardDescription>{t("Hanya saldo dari QRIS Pakasir sukses yang dapat ditarik.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-sm text-white/70">{t("Saldo Digital Tersedia")}</p>
            <p className="mt-1 text-3xl font-black">{formatCurrency(availableBalance)}</p>
            <p className="mt-2 text-xs text-white/50">Earned {formatCurrency(earnedQris)} • Reserved {formatCurrency(reserved)}</p>
          </div>
          <div className="space-y-2"><Label>{t("Nama Bank")}</Label><Select value={bankName} onChange={(event) => setBankName(event.target.value)}><option>BCA</option><option>BRI</option><option>Mandiri</option><option>BNI</option></Select></div>
          <div className="space-y-2"><Label>{t("Nomor Rekening")}</Label><Input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="1234567890" /></div>
          <div className="space-y-2"><Label>{t("Atas Nama")}</Label><Input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Ayu Lestari" /></div>
          <div className="space-y-2"><Label>{t("Jumlah Penarikan")}</Label><Input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" placeholder="500000" /></div>
          <div className={`rounded-2xl p-4 text-sm ${invalid ? "bg-red-50 text-red-700" : "bg-secondary text-secondary-foreground"}`}><AlertCircle className="mb-2 h-4 w-4" /> {helper}</div>
          <Button disabled={!canSubmit || saving} className="w-full" onClick={submitWithdrawal}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} {t("Ajukan Penarikan")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t("Status Request")}</CardTitle>
              <CardDescription>{t("Status berubah saat Owner menandai transfer selesai.")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" /> {t("Refresh")}</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat data...")}</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>{t("Tanggal")}</TableHead><TableHead>Bank</TableHead><TableHead>{t("Jumlah")}</TableHead><TableHead>{t("Status")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {withdrawals.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{shortDate(item.createdAt)}</TableCell>
                    <TableCell>{item.bankName} • {item.accountNumber}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(item.amount)}</TableCell>
                    <TableCell><Badge variant={statusVariant(item.status)}>{withdrawalStatusLabel(item.status)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={passwordModalOpen}
        title="Konfirmasi Password Admin"
        description="Demi keamanan rekening, masukkan password admin yang sedang login sebelum request penarikan dikirim ke Owner."
        onClose={() => !saving ? setPasswordModalOpen(false) : undefined}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#eff4ff] p-4 text-sm text-[#3d4a42]">
            <div className="flex items-center gap-2 font-bold text-[#0b1c30]">
              <ShieldCheck className="h-4 w-4 text-primary" /> Validasi keamanan withdrawal
            </div>
            <p className="mt-2">
              Tujuan rekening: <b>{bankName} • {accountNumber || "-"}</b><br />
              Atas nama: <b>{accountName || "-"}</b><br />
              Jumlah: <b>{formatCurrency(amountNumber)}</b>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Password admin</Label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(event) => {
                setAdminPassword(event.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Masukkan password akun admin"
              autoFocus
              aria-invalid={passwordError ? "true" : "false"}
              className={passwordError ? "border-red-400 bg-red-50 focus-visible:ring-red-200" : undefined}
              onKeyDown={(event) => {
                if (event.key === "Enter") void confirmWithdrawal();
              }}
            />
            {passwordError ? (
              <div role="alert" aria-live="assertive" className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={confirmWithdrawal} disabled={saving || !adminPassword.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Konfirmasi & Kirim
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
