"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, NotebookPen, Plus, RefreshCw, Search } from "lucide-react";
import { api, debtStatusLabel, type DebtRecord, type OwnerDebtRow } from "@/lib/api-client";
import { formatCurrency, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type DebtView = DebtRecord & { shopName?: string; adminName?: string };

function statusVariant(status: DebtRecord["status"], dueDate?: string | null) {
  if (status === "paid") return "success" as const;
  if (isOverdue(status, dueDate)) return "danger" as const;
  if (status === "partial") return "blue" as const;
  return "warning" as const;
}

function isOverdue(status: DebtRecord["status"], dueDate?: string | null) {
  return status !== "paid" && Boolean(dueDate) && new Date(dueDate as string).getTime() < Date.now();
}

function normalizeOwnerRows(rows: OwnerDebtRow[]): DebtView[] {
  return rows.map((row) => ({
    ...row.debt,
    shopName: row.shop.name,
    adminName: row.admin.name,
  }));
}

export function DebtLedger({ ownerView = false }: { ownerView?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Semua");
  const [debts, setDebts] = useState<DebtView[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDebts() {
    setLoading(true);
    setError(null);
    try {
      if (ownerView) {
        const rows = await api.owner.debts.list();
        setDebts(normalizeOwnerRows(rows));
      } else {
        const rows = await api.debts.list();
        setDebts(rows);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data hutang");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDebts();
  }, [ownerView]);

  const filteredDebts = useMemo(() => {
    const keyword = query.toLowerCase().trim();
    return debts.filter((debt) => {
      const label = isOverdue(debt.status, debt.dueDate) ? "Jatuh Tempo" : debtStatusLabel(debt.status);
      const matchesKeyword = !keyword || debt.customerName.toLowerCase().includes(keyword) || (debt.customerPhone ?? "").includes(keyword) || (debt.shopName ?? "").toLowerCase().includes(keyword);
      const matchesStatus = status === "Semua" || label === status;
      return matchesKeyword && matchesStatus;
    });
  }, [query, status, debts]);

  const outstanding = debts.filter((debt) => debt.status !== "paid").reduce((sum, debt) => sum + debt.amount - debt.paidAmount, 0);
  const overdue = debts.filter((debt) => isOverdue(debt.status, debt.dueDate)).reduce((sum, debt) => sum + debt.amount - debt.paidAmount, 0);
  const paid = debts.filter((debt) => debt.status === "paid").reduce((sum, debt) => sum + debt.paidAmount, 0);

  async function addManualDebt() {
    if (!customerName || !amount) {
      setError("Nama pelanggan dan nominal wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.debts.create({ customerName, customerPhone, amount: Number(amount), dueDate, note });
      setDebts((current) => [created, ...current]);
      setCustomerName("");
      setCustomerPhone("");
      setAmount("");
      setDueDate("");
      setNote("");
      setMessage("Catatan hutang berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan hutang");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(debt: DebtView) {
    const remaining = debt.amount - debt.paidAmount;
    if (remaining <= 0) return;
    setError(null);
    try {
      const result = await api.debts.pay(debt.id, { amount: remaining, note: "Ditandai lunas dari frontend" });
      setDebts((current) => current.map((item) => item.id === debt.id ? { ...item, ...result.debt } : item));
      setMessage("Hutang berhasil ditandai lunas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai lunas");
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[#3d4a42]">Total Belum Lunas</p><p className="mt-2 text-3xl font-extrabold text-primary">{formatCurrency(outstanding)}</p></div><NotebookPen className="h-9 w-9 text-primary" /></div></CardContent></Card>
        <Card className="bg-white"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[#3d4a42]">Jatuh Tempo</p><p className="mt-2 text-3xl font-extrabold text-red-700">{formatCurrency(overdue)}</p></div><CalendarClock className="h-9 w-9 text-red-700" /></div></CardContent></Card>
        <Card className="bg-white"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[#3d4a42]">Sudah Dibayar</p><p className="mt-2 text-3xl font-extrabold text-[#00628d]">{formatCurrency(paid)}</p></div><CheckCircle2 className="h-9 w-9 text-[#00628d]" /></div></CardContent></Card>
      </div>

      {!ownerView ? (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Input Hutang Manual</CardTitle>
            <CardDescription>Form ini mengirim data ke endpoint <code>/api/debts</code>.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2"><Label>Nama pelanggan</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Contoh Bu Lina" /></div>
              <div className="space-y-2"><Label>No. HP</Label><Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="08xxxxxxxxxx" /></div>
              <div className="space-y-2"><Label>Nominal</Label><Input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" placeholder="150000" /></div>
              <div className="space-y-2"><Label>Jatuh tempo</Label><Input value={dueDate} onChange={(event) => setDueDate(event.target.value)} type="date" /></div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan barang, alamat, atau kesepakatan pembayaran..." />
              <Button size="lg" className="h-full min-h-[110px]" onClick={addManualDebt} disabled={saving}>{saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />} Tambah Catatan Hutang</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-white">
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <CardTitle>{ownerView ? "Piutang Semua Cabang" : "Buku Hutang Pelanggan"}</CardTitle>
              <CardDescription>{ownerView ? "Owner dapat memantau piutang lintas UMKM dan risiko jatuh tempo." : "Pantau pelanggan yang belum melunasi pembelian."}</CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-[260px_180px_120px]">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[#3d4a42]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" placeholder="Cari pelanggan/UMKM" /></div>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}><option>Semua</option><option>Belum Lunas</option><option>Sebagian</option><option>Lunas</option><option>Jatuh Tempo</option></Select>
              <Button variant="outline" onClick={loadDebts}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat buku hutang...</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Pelanggan</TableHead>{ownerView ? <TableHead>Cabang</TableHead> : null}<TableHead>Nominal</TableHead><TableHead>Dibayar</TableHead><TableHead>Jatuh Tempo</TableHead><TableHead>Status</TableHead>{!ownerView ? <TableHead>Aksi</TableHead> : null}</TableRow></TableHeader>
              <TableBody>
                {filteredDebts.map((debt) => {
                  const label = isOverdue(debt.status, debt.dueDate) ? "Jatuh Tempo" : debtStatusLabel(debt.status);
                  return (
                    <TableRow key={debt.id}>
                      <TableCell><p className="font-bold">{debt.customerName}</p><p className="text-xs text-[#3d4a42]">{debt.customerPhone || "Tanpa nomor"}</p></TableCell>
                      {ownerView ? <TableCell><p className="font-medium">{debt.shopName}</p><p className="text-xs text-[#3d4a42]">{debt.adminName}</p></TableCell> : null}
                      <TableCell className="font-semibold">{formatCurrency(debt.amount)}</TableCell>
                      <TableCell>{formatCurrency(debt.paidAmount)}</TableCell>
                      <TableCell>{debt.dueDate ? shortDate(debt.dueDate) : "-"}</TableCell>
                      <TableCell><Badge variant={statusVariant(debt.status, debt.dueDate)} className="normal-case tracking-normal">{label}</Badge></TableCell>
                      {!ownerView ? <TableCell><Button size="sm" variant="outline" disabled={debt.status === "paid"} onClick={() => markPaid(debt)}>Tandai Lunas</Button></TableCell> : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
