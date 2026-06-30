"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api, paymentMethodLabel, transactionStatusLabel, type TransactionRecord } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, shortDate } from "@/lib/utils";

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

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTransactions() {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.transactions.list();
      setTransactions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat transaksi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  return (
    <Card className="min-w-0 max-w-full overflow-hidden bg-white">
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Semua Transaksi</CardTitle>
            <CardDescription className="break-words">Data transaksi dari endpoint <code className="break-all">/api/transactions</code>.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadTransactions}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="max-w-full overflow-x-auto px-4 sm:px-6">
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat transaksi...</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Order ID</TableHead><TableHead>Metode</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Ref</TableHead></TableRow></TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{shortDate(transaction.createdAt)}</TableCell>
                  <TableCell className="max-w-[8rem] truncate whitespace-nowrap font-bold" title={transaction.id}>{shortOrderId(transaction.id)}</TableCell>
                  <TableCell>{paymentMethodLabel(transaction.paymentMethod)}</TableCell>
                  <TableCell>{formatCurrency(transaction.total)}</TableCell>
                  <TableCell><Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{transactionStatusLabel(transaction.status)}</Badge></TableCell>
                  <TableCell className="max-w-[8rem] truncate whitespace-nowrap text-muted-foreground" title={transaction.externalRef || ""}>{transaction.externalRef ? shortOrderId(transaction.externalRef) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
