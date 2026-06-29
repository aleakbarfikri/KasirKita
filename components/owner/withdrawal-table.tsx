"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { api, withdrawalStatusLabel, type OwnerWithdrawalRow } from "@/lib/api-client";
import { formatCurrency, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusVariant(status: OwnerWithdrawalRow["withdrawal"]["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "processed") return "secondary" as const;
  return "danger" as const;
}

export function WithdrawalTable() {
  const [items, setItems] = useState<OwnerWithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.owner.withdrawals.list();
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat withdrawal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function markDone(id: string) {
    setWorkingId(id);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.owner.withdrawals.complete(id);
      setItems((current) => current.map((item) => item.withdrawal.id === id ? { ...item, withdrawal: updated } : item));
      setMessage("Withdrawal ditandai selesai dan saldo withdrawn admin diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai selesai");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Request Penarikan Dana</CardTitle>
            <CardDescription>Owner melakukan transfer manual, lalu menandai request sebagai selesai.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadItems}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mb-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat data...</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Admin</TableHead><TableHead>Rekening</TableHead><TableHead>Jumlah</TableHead><TableHead>Status</TableHead><TableHead>Aksi Owner</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.withdrawal.id}>
                  <TableCell>{shortDate(item.withdrawal.createdAt)}</TableCell>
                  <TableCell><p className="font-medium">{item.admin.name}</p><p className="text-xs text-muted-foreground">{item.admin.shopName || item.admin.email}</p></TableCell>
                  <TableCell><p>{item.withdrawal.bankName} • {item.withdrawal.accountNumber}</p><p className="text-xs text-muted-foreground">a.n. {item.withdrawal.accountName}</p></TableCell>
                  <TableCell className="font-semibold">{formatCurrency(item.withdrawal.amount)}</TableCell>
                  <TableCell><Badge variant={statusVariant(item.withdrawal.status)}>{withdrawalStatusLabel(item.withdrawal.status)}</Badge></TableCell>
                  <TableCell><Button disabled={item.withdrawal.status === "completed" || workingId === item.withdrawal.id} size="sm" onClick={() => markDone(item.withdrawal.id)}>{workingId === item.withdrawal.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Tandai Selesai</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
