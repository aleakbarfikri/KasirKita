"use client";

import { useEffect, useState } from "react";
import { Clock3, Loader2, RefreshCw, Save } from "lucide-react";
import { api, type CashShiftRecord } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, shortDate } from "@/lib/utils";
import { useAppLanguage } from "@/lib/i18n";

export function ShiftManager() {
  const { t } = useAppLanguage();
  const [shifts, setShifts] = useState<CashShiftRecord[]>([]);
  const [cashCounted, setCashCounted] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadShifts() {
    setLoading(true);
    setError(null);
    try {
      setShifts(await api.shifts.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Gagal memuat shift"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShifts();
  }, []);

  async function closeShift() {
    setClosing(true);
    setError(null);
    setMessage(null);
    try {
      const shift = await api.shifts.close({
        cashCounted: cashCounted.trim() ? Number(cashCounted) : null,
        note: note.trim() || undefined,
      });
      setShifts((current) => [shift, ...current.filter((row) => row.id !== shift.id)]);
      setCashCounted("");
      setNote("");
      setMessage(`${t("Shift berhasil ditutup.")} ${t("Selisih kas")}: ${formatCurrency(shift.cashDifference ?? 0)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Gagal menutup shift"));
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" /> {t("Tutup Shift")}</CardTitle>
          <CardDescription>{t("Hitung transaksi sejak shift terakhir kasir sampai saat ini.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="cashCounted">{t("Uang Tunai Fisik")}</Label>
            <Input
              id="cashCounted"
              type="number"
              min={0}
              value={cashCounted}
              onChange={(event) => setCashCounted(event.target.value)}
              placeholder={t("Contoh: 250000")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shiftNote">{t("Catatan")}</Label>
            <Input id="shiftNote" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("Opsional")} />
          </div>
          <Button className="w-full" onClick={closeShift} disabled={closing || loading}>
            {closing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t("Tutup Shift Sekarang")}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-w-0 bg-white">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("Riwayat Shift")}</CardTitle>
              <CardDescription>{t("Rekap tunai, QRIS, hutang, transaksi batal, dan laba kotor.")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadShifts} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> {t("Refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat shift...")}</div>
          ) : shifts.length === 0 ? (
            <p className="rounded-2xl bg-[#eff4ff] p-4 text-sm text-[#3d4a42]">{t("Belum ada shift yang ditutup.")}</p>
          ) : (
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Ditutup")}</TableHead>
                  <TableHead>{t("Kasir")}</TableHead>
                  <TableHead>{t("Transaksi")}</TableHead>
                  <TableHead>{t("Tunai")}</TableHead>
                  <TableHead>QRIS</TableHead>
                  <TableHead>{t("Hutang")}</TableHead>
                  <TableHead>{t("Batal")}</TableHead>
                  <TableHead>{t("Laba")}</TableHead>
                  <TableHead>{t("Selisih Kas")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{shortDate(shift.closedAt)}</TableCell>
                    <TableCell>{shift.cashierName || "-"}</TableCell>
                    <TableCell>{shift.transactionCount}</TableCell>
                    <TableCell>{formatCurrency(shift.cashSales)}</TableCell>
                    <TableCell>{formatCurrency(shift.qrisStaticSales + shift.qrisPakasirSales)}</TableCell>
                    <TableCell>{formatCurrency(shift.debtSales)}</TableCell>
                    <TableCell>{formatCurrency(shift.cancelledSales)}</TableCell>
                    <TableCell>{formatCurrency(shift.grossProfit)}</TableCell>
                    <TableCell className={(shift.cashDifference ?? 0) < 0 ? "font-bold text-red-700" : "font-bold text-emerald-700"}>
                      {shift.cashDifference === null || shift.cashDifference === undefined ? "-" : formatCurrency(shift.cashDifference)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
