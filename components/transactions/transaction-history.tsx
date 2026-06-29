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
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Semua Transaksi</CardTitle>
            <CardDescription>Data transaksi dari endpoint <code>/api/transactions</code>.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadTransactions}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
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
                  <TableCell className="font-bold">{transaction.id}</TableCell>
                  <TableCell>{paymentMethodLabel(transaction.paymentMethod)}</TableCell>
                  <TableCell>{formatCurrency(transaction.total)}</TableCell>
                  <TableCell><Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{transactionStatusLabel(transaction.status)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{transaction.externalRef || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
