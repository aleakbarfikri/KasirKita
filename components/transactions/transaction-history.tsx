"use client";

import { useEffect, useState } from "react";
import { Ban, Download, Loader2, RefreshCw } from "lucide-react";
import { api, paymentMethodLabel, transactionStatusLabel, type TransactionRecord } from "@/lib/api-client";
import { cacheTransactions, readCachedTransactions } from "@/lib/offline-pos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, shortDate } from "@/lib/utils";
import { useAppLanguage, type AppLanguage } from "@/lib/i18n";

function statusVariant(status: TransactionRecord["status"]) {
  if (status === "success") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "cancelled") return "secondary" as const;
  return "danger" as const;
}

function shortOrderId(id?: string | null) {
  if (!id) return "-";

  const cleanId = id.replace(/^trx_/i, "");
  const shortId = cleanId.slice(0, 6).toUpperCase();

  return shortId ? `TRX-${shortId}` : "-";
}

function itemSummary(transaction: TransactionRecord) {
  return transaction.items?.map((item) => `${item.name} x${item.quantity}`).join(", ") || "-";
}

function methodLabel(method: TransactionRecord["paymentMethod"], language: AppLanguage) {
  const id = paymentMethodLabel(method);
  if (language === "id") return id;
  const map: Record<string, string> = {
    Tunai: "Cash",
    "QRIS Statis": "Static QRIS",
    "QRIS Pakasir": "Pakasir QRIS",
    Hutang: "Debt",
  };
  return map[id] ?? id;
}

function statusLabel(status: TransactionRecord["status"], language: AppLanguage) {
  const id = transactionStatusLabel(status);
  if (language === "id") return id;
  const map: Record<string, string> = {
    Menunggu: "Pending",
    Sukses: "Success",
    Gagal: "Failed",
    Dibatalkan: "Cancelled",
  };
  return map[id] ?? id;
}

export function TransactionHistory() {
  const { language, t } = useAppLanguage();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTransactions() {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.transactions.list();
      setTransactions(rows);
      cacheTransactions(rows);
    } catch (err) {
      const cached = readCachedTransactions();
      if (cached?.transactions.length) {
        setTransactions(cached.transactions);
        setError(`${t("Mode offline")}: ${t("transaksi memakai cache terakhir")} (${new Date(cached.cachedAt).toLocaleString("id-ID")}).`);
      } else {
        setError(err instanceof Error ? err.message : t("Gagal memuat transaksi"));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  async function exportTransactions() {
    setExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/transactions/export", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        let message = "Gagal export transaksi";
        try {
          const payload = await response.json();
          message = payload?.error?.message || message;
        } catch {
          // Keep default message for non-JSON responses.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] || `kasirkita-transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export transaksi");
    } finally {
      setExporting(false);
    }
  }

  async function voidTransaction(transaction: TransactionRecord) {
    const reason = window.prompt(`Alasan void untuk ${shortOrderId(transaction.id)}:`);
    if (!reason) return;
    setVoidingId(transaction.id);
    setError(null);
    try {
      await api.transactions.void(transaction.id, { reason });
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal void transaksi");
    } finally {
      setVoidingId(null);
    }
  }

  return (
    <Card className="w-full min-w-0 max-w-full bg-white">
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("Semua Transaksi")}</CardTitle>
            <CardDescription className="break-words">{t("Rekap transaksi dan barang yang terjual.")}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={exportTransactions} disabled={exporting || loading}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? t("Export...") : t("Export CSV")}
            </Button>
            <Button variant="outline" size="sm" onClick={loadTransactions}><RefreshCw className="mr-2 h-4 w-4" /> {t("Refresh")}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="w-full max-w-full overflow-x-auto px-4 sm:px-6 [-webkit-overflow-scrolling:touch]">
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat transaksi...")}</div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-2xl border border-[#bccac0] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-[#0b1c30]">{shortOrderId(transaction.id)}</p>
                      <p className="mt-1 text-xs text-[#3d4a42]">{shortDate(transaction.createdAt)}</p>
                    </div>
                    <Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{statusLabel(transaction.status, language)}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#0b1c30]">{itemSummary(transaction)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-[#3d4a42]">{t("Metode")}</p><p className="font-bold">{methodLabel(transaction.paymentMethod, language)}</p></div>
                    <div><p className="text-xs text-[#3d4a42]">{t("Total")}</p><p className="font-bold">{formatCurrency(transaction.total)}</p></div>
                    <div><p className="text-xs text-[#3d4a42]">{t("Laba")}</p><p className="font-bold">{formatCurrency(transaction.grossProfit ?? 0)}</p></div>
                    <div><p className="text-xs text-[#3d4a42]">Ref</p><p className="font-bold">{transaction.externalRef ? shortOrderId(transaction.externalRef) : "-"}</p></div>
                  </div>
                  {transaction.status === "success" ? (
                    <Button variant="outline" size="sm" className="mt-4 w-full text-red-700" onClick={() => voidTransaction(transaction)} disabled={voidingId === transaction.id}>
                      {voidingId === transaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                      Void Transaksi
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[900px]">
                <TableHeader><TableRow><TableHead>{t("Tanggal")}</TableHead><TableHead>{t("Order ID")}</TableHead><TableHead>{t("Barang")}</TableHead><TableHead>{t("Metode")}</TableHead><TableHead>{t("Total")}</TableHead><TableHead>{t("Laba")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead>Ref</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{shortDate(transaction.createdAt)}</TableCell>
                      <TableCell className="max-w-[8rem] truncate whitespace-nowrap font-bold" title={transaction.id}>{shortOrderId(transaction.id)}</TableCell>
                      <TableCell className="max-w-[16rem] truncate" title={itemSummary(transaction)}>{itemSummary(transaction)}</TableCell>
                      <TableCell>{methodLabel(transaction.paymentMethod, language)}</TableCell>
                      <TableCell>{formatCurrency(transaction.total)}</TableCell>
                      <TableCell>{formatCurrency(transaction.grossProfit ?? 0)}</TableCell>
                      <TableCell><Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{statusLabel(transaction.status, language)}</Badge></TableCell>
                      <TableCell className="max-w-[8rem] truncate whitespace-nowrap text-muted-foreground" title={transaction.externalRef || ""}>{transaction.externalRef ? shortOrderId(transaction.externalRef) : "-"}</TableCell>
                      <TableCell>
                        {transaction.status === "success" ? (
                          <Button variant="outline" size="sm" className="text-red-700" onClick={() => voidTransaction(transaction)} disabled={voidingId === transaction.id}>
                            {voidingId === transaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                            Void
                          </Button>
                        ) : "-"}
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
  );
}
