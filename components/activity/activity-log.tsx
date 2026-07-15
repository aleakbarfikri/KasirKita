"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Loader2, RefreshCw, Search, X } from "lucide-react";
import { api, type AuditLogRecord, type OwnerAdminRow } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/utils";
import { useAppLanguage } from "@/lib/i18n";

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

export function ActivityLog({ viewerRole }: { viewerRole: "owner" | "admin" }) {
  const { t } = useAppLanguage();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [admins, setAdmins] = useState<OwnerAdminRow[]>([]);
  const [search, setSearch] = useState("");
  const [adminFilter, setAdminFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextLogs, nextAdmins] = await Promise.all([
        api.auditLogs.list(),
        viewerRole === "owner" ? api.owner.admins.list() : Promise.resolve([]),
      ]);
      setLogs(nextLogs);
      setAdmins(nextAdmins);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat log aktivitas");
    } finally {
      setLoading(false);
    }
  }, [viewerRole]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (adminFilter !== "all" && log.adminId !== adminFilter) return false;
      if (!keyword) return true;
      const haystack = [log.action, actionLabel(log.action), log.actorName, log.actorUsername, log.actorRole, log.adminName, log.shopName, log.message, log.entityType, log.entityId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [adminFilter, logs, search]);

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> {t("Log Aktivitas")}</CardTitle>
            <CardDescription>{t("Catatan transaksi, void, hutang, shift, QRIS, backup, dan restore.")}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> {t("Refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p> : null}
        <div className={`mb-4 grid gap-3 rounded-xl border border-[#bec9c1] bg-[#f8fafc] p-3 ${viewerRole === "owner" ? "md:grid-cols-[minmax(0,1fr)_260px]" : ""}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f7a72]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Cari aktivitas, nama, toko, atau transaksi...")}
              className="h-11 pl-10 pr-10"
              aria-label={t("Cari log aktivitas")}
            />
            {search ? <button type="button" onClick={() => setSearch("")} aria-label={t("Hapus pencarian")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#64748b] hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
          </div>
          {viewerRole === "owner" ? (
            <select value={adminFilter} onChange={(event) => setAdminFilter(event.target.value)} className="h-11 rounded-xl border border-[#bec9c1] bg-white px-3 text-sm font-bold text-[#151b2d] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" aria-label={t("Filter berdasarkan admin")}>
              <option value="all">{t("Semua Admin")}</option>
              {admins.map((row) => <option key={row.admin.id} value={row.admin.id}>{row.admin.name} — {row.shop.name}</option>)}
            </select>
          ) : null}
        </div>
        {loading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat log...")}</div>
        ) : filteredLogs.length === 0 ? (
          <p className="rounded-2xl bg-[#eff4ff] p-4 text-sm text-[#3d4a42]">{logs.length ? t("Tidak ada aktivitas yang cocok dengan filter.") : t("Belum ada aktivitas tercatat.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Waktu")}</TableHead>
                  <TableHead>{t("Aksi")}</TableHead>
                  <TableHead>{t("Pelaku / Role")}</TableHead>
                  <TableHead>{t("Aktivitas")}</TableHead>
                  <TableHead>{t("Entity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{shortDate(log.createdAt)}</TableCell>
                    <TableCell><Badge variant={log.action.includes("void") || log.action.includes("restore") ? "warning" : "secondary"} className="normal-case tracking-normal">{t(actionLabel(log.action))}</Badge></TableCell>
                    <TableCell>
                      <p className="font-bold text-[#0f172a]">{log.actorName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="capitalize tracking-normal">{log.actorRole}</Badge>
                        {log.adminName && log.actorRole !== "admin" ? <span className="text-xs text-[#64748b]">{t("Admin")}: {log.adminName}</span> : null}
                      </div>
                      {log.shopName ? <p className="mt-1 text-xs text-[#64748b]">{log.shopName}</p> : null}
                    </TableCell>
                    <TableCell className="max-w-[28rem]">{log.message}</TableCell>
                    <TableCell className="text-xs text-[#3d4a42]">{log.entityType}{log.entityId ? ` / ${log.entityId}` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
