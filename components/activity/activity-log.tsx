"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { api, type AuditLogRecord } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/utils";

function actionLabel(action: string) {
  const map: Record<string, string> = {
    create_transaction: "Transaksi",
    create_debt: "Hutang",
    confirm_qris_pakasir: "QRIS Paid",
    void_transaction: "Void",
    close_shift: "Shift",
    create_backup: "Backup",
    restore_backup: "Restore",
    create_product: "Produk Baru",
    update_product: "Update Produk",
    delete_product: "Hapus Produk",
    import_products: "Import Produk",
    pay_debt: "Bayar Hutang",
  };
  return map[action] ?? action;
}

export function ActivityLog() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      setLogs(await api.auditLogs.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat log aktivitas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Log Aktivitas</CardTitle>
            <CardDescription>Catatan transaksi, void, hutang, shift, QRIS, backup, dan restore.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {loading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat log...</div>
        ) : logs.length === 0 ? (
          <p className="rounded-2xl bg-[#eff4ff] p-4 text-sm text-[#3d4a42]">Belum ada aktivitas tercatat.</p>
        ) : (
          <Table className="min-w-[840px]">
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{shortDate(log.createdAt)}</TableCell>
                  <TableCell><Badge variant={log.action.includes("void") || log.action.includes("restore") ? "warning" : "secondary"} className="normal-case tracking-normal">{actionLabel(log.action)}</Badge></TableCell>
                  <TableCell className="capitalize">{log.actorRole}</TableCell>
                  <TableCell className="max-w-[28rem]">{log.message}</TableCell>
                  <TableCell className="text-xs text-[#3d4a42]">{log.entityType}{log.entityId ? ` / ${log.entityId}` : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
