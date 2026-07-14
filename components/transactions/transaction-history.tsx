"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Ban, Download, ExternalLink, Loader2, Printer, RefreshCw, Search } from "lucide-react";
import { api, paymentMethodLabel, transactionStatusLabel, type ReceiptRecord, type TransactionRecord } from "@/lib/api-client";
import { cacheTransactions, readCachedTransactions } from "@/lib/offline-pos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, shortDate } from "@/lib/utils";
import { useAppLanguage, type AppLanguage } from "@/lib/i18n";

type ReceiptPaperWidth = "58mm" | "80mm";

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
    "QRIS KasirKita": "KasirKita QRIS",
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

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

async function printThermalReceipt(receipt: ReceiptRecord, paperWidth: ReceiptPaperWidth) {
  const trx = receipt.transaction;
  const contentPadding = paperWidth === "80mm" ? "10px" : "7px";
  const qrSize = paperWidth === "80mm" ? 160 : 132;
  const qrDataUrl = receipt.publicUrl ? await QRCode.toDataURL(receipt.publicUrl, { margin: 1, width: qrSize }) : "";
  const itemRows = receipt.items.map((item) => `
    <div class="item">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="row muted"><span>${item.quantity} x ${escapeHtml(formatCurrency(item.price))}</span><span>${escapeHtml(formatCurrency(item.price * item.quantity))}</span></div>
      ${item.discountAmount ? `<div class="muted small">Diskon item: ${escapeHtml(formatCurrency(item.discountAmount))} / pcs</div>` : ""}
    </div>
  `).join("");
  const html = `<!doctype html>
    <html><head><title>Reprint ${escapeHtml(trx.invoiceNumber)}</title>
    <style>
      @page { size: ${paperWidth} auto; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #000; font: 11px "Courier New", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; line-height: 1.28; }
      .receipt { width: ${paperWidth}; max-width: ${paperWidth}; padding: ${contentPadding}; box-sizing: border-box; }
      .center { text-align: center; }
      .shop { font-weight: 800; font-size: 13px; text-transform: uppercase; }
      .watermark { margin-bottom: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: lowercase; }
      .line { border-top: 1px dashed #000; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .row span:first-child { min-width: 0; overflow-wrap: anywhere; }
      .row span:last-child { text-align: right; }
      .item { margin: 6px 0; }
      .item-name { font-weight: 700; overflow-wrap: anywhere; }
      .muted { color: #333; }
      .total { font-size: 13px; font-weight: 900; }
      .qr { display: block; width: ${paperWidth === "80mm" ? "34mm" : "28mm"}; height: ${paperWidth === "80mm" ? "34mm" : "28mm"}; margin: 4px auto 2px; }
      .small { font-size: 9px; }
    </style></head><body>
      <div class="receipt">
        <div class="center">
          ${receipt.showWatermark ? `<div class="watermark">${escapeHtml(receipt.watermarkText || "www.kasir-kita.com")}</div>` : ""}
          <div class="shop">${escapeHtml(receipt.shop.name)}</div>
          ${receipt.shop.address ? `<div>${escapeHtml(receipt.shop.address)}</div>` : ""}
          <div>${receipt.shop.phone ? `Telp: ${escapeHtml(receipt.shop.phone)}` : ""}</div>
        </div>
        <div class="line"></div>
        <div class="row"><span>Invoice</span><span>${escapeHtml(trx.invoiceNumber)}</span></div>
        <div class="row"><span>Tanggal</span><span>${escapeHtml(new Date(trx.createdAt).toLocaleString("id-ID"))}</span></div>
        <div class="row"><span>Kasir</span><span>${escapeHtml(receipt.cashier.name)}</span></div>
        <div class="row"><span>Metode</span><span>${escapeHtml(paymentMethodLabel(trx.paymentMethod))}</span></div>
        <div class="line"></div>
        ${itemRows}
        <div class="line"></div>
        ${trx.subtotal !== undefined ? `<div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(trx.subtotal))}</span></div>` : ""}
        ${trx.discountAmount ? `<div class="row"><span>Diskon</span><span>-${escapeHtml(formatCurrency(trx.discountAmount))}</span></div>` : ""}
        <div class="row total"><span>Total</span><span>${escapeHtml(formatCurrency(trx.total))}</span></div>
        ${trx.paidAmount !== null && trx.paidAmount !== undefined ? `<div class="row"><span>Dibayar</span><span>${escapeHtml(formatCurrency(trx.paidAmount))}</span></div>` : ""}
        ${trx.changeAmount !== null && trx.changeAmount !== undefined ? `<div class="row"><span>Kembalian</span><span>${escapeHtml(formatCurrency(trx.changeAmount))}</span></div>` : ""}
        ${qrDataUrl ? `<div class="line"></div><div class="center"><div>Struk digital</div><img class="qr" src="${qrDataUrl}" alt="QR struk digital" /><div class="small">Scan / simpan QR ini</div></div>` : ""}
        <div class="line"></div>
        <div class="center">REPRINT</div>
        <div class="center">Terima kasih</div>
      </div>
      <script>
        window.addEventListener("load", function () {
          setTimeout(function () { window.print(); }, 180);
        });
      </script>
    </body></html>`;
  const win = window.open("", "_blank", "width=360,height=720");
  if (!win) throw new Error("Popup print diblokir browser. Izinkan popup untuk mencetak struk.");
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function TransactionHistory() {
  const { language, t } = useAppLanguage();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionRecord["status"]>("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<ReceiptPaperWidth>("58mm");
  const [printing, setPrinting] = useState(false);
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

  async function openTransactionDetail(transaction: TransactionRecord) {
    setSelectedTransaction(transaction);
    setSelectedReceipt(null);
    setReceiptLoading(Boolean(transaction.receiptToken));
    if (!transaction.receiptToken) return;
    try {
      const receipt = await api.receipts.get(transaction.receiptToken);
      setSelectedReceipt(receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat struk transaksi");
    } finally {
      setReceiptLoading(false);
    }
  }

  async function reprintSelectedReceipt() {
    if (!selectedReceipt) return;
    setPrinting(true);
    setError(null);
    try {
      await printThermalReceipt(selectedReceipt, receiptPaperWidth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reprint struk");
    } finally {
      setPrinting(false);
    }
  }

  function closeDetail() {
    if (printing) return;
    setSelectedTransaction(null);
    setSelectedReceipt(null);
    setReceiptLoading(false);
  }

  const filteredTransactions = transactions.filter((transaction) => {
    const haystack = [
      transaction.id,
      transaction.externalRef,
      transaction.cashierName,
      methodLabel(transaction.paymentMethod, language),
      statusLabel(transaction.status, language),
      itemSummary(transaction),
    ].join(" ").toLowerCase();
    return (statusFilter === "all" || transaction.status === statusFilter) && haystack.includes(searchTerm.trim().toLowerCase());
  });

  return (
    <>
    <Card className="kk-stitch-card w-full min-w-0 max-w-full">
      <CardHeader className="border-b border-[#bec9c1]">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl text-[#151b2d]">{t("Semua Transaksi")}</CardTitle>
            <CardDescription className="break-words font-semibold text-[#505f76]">{t("Rekap transaksi dan barang yang terjual.")}</CardDescription>
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
        <div className="mb-4 grid gap-3 rounded-xl border border-[#bec9c1] bg-[#f8fafc] p-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f7a72]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("Cari order, barang, kasir, atau metode...")}
              className="h-11 w-full rounded-xl border border-[#bec9c1] bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | TransactionRecord["status"])}
            className="h-11 rounded-xl border border-[#bec9c1] bg-white px-3 text-sm font-bold text-[#151b2d] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="all">{t("Semua Status")}</option>
            <option value="success">{statusLabel("success", language)}</option>
            <option value="pending">{statusLabel("pending", language)}</option>
            <option value="failed">{statusLabel("failed", language)}</option>
            <option value="cancelled">{statusLabel("cancelled", language)}</option>
          </select>
        </div>
        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat transaksi...")}</div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredTransactions.map((transaction) => (
                <div key={transaction.id} role="button" tabIndex={0} onClick={() => openTransactionDetail(transaction)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openTransactionDetail(transaction); }} className="block w-full rounded-xl border border-[#d7e2dc] bg-white p-4 text-left shadow-sm transition hover:border-primary hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-[#0f172a]">{shortOrderId(transaction.id)}</p>
                      <p className="mt-1 text-xs font-medium text-[#64748b]">{shortDate(transaction.createdAt)}</p>
                    </div>
                    <Badge variant={statusVariant(transaction.status)} className="normal-case tracking-normal">{statusLabel(transaction.status, language)}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#0f172a]">{itemSummary(transaction)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs font-medium text-[#64748b]">{t("Metode")}</p><p className="font-bold">{methodLabel(transaction.paymentMethod, language)}</p></div>
                    <div><p className="text-xs font-medium text-[#64748b]">{t("Total")}</p><p className="font-bold">{formatCurrency(transaction.total)}</p></div>
                    <div><p className="text-xs font-medium text-[#64748b]">{t("Laba")}</p><p className="font-bold">{formatCurrency(transaction.grossProfit ?? 0)}</p></div>
                    <div><p className="text-xs text-[#3d4a42]">Ref</p><p className="font-bold">{transaction.externalRef ? shortOrderId(transaction.externalRef) : "-"}</p></div>
                  </div>
                  {transaction.status === "success" ? (
                    <Button variant="outline" size="sm" className="mt-4 w-full text-red-700" onClick={(event) => { event.stopPropagation(); voidTransaction(transaction); }} disabled={voidingId === transaction.id}>
                      {voidingId === transaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                      Void Transaksi
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[900px]">
                <TableHeader><TableRow className="bg-[#f2f3ff] hover:bg-[#f2f3ff]"><TableHead className="uppercase tracking-[0.12em]">{t("Tanggal")}</TableHead><TableHead className="uppercase tracking-[0.12em]">{t("Order ID")}</TableHead><TableHead className="uppercase tracking-[0.12em]">{t("Barang")}</TableHead><TableHead className="uppercase tracking-[0.12em]">{t("Metode")}</TableHead><TableHead className="uppercase tracking-[0.12em]">{t("Total")}</TableHead><TableHead className="uppercase tracking-[0.12em]">{t("Laba")}</TableHead><TableHead className="uppercase tracking-[0.12em]">{t("Status")}</TableHead><TableHead className="uppercase tracking-[0.12em]">Ref</TableHead><TableHead className="uppercase tracking-[0.12em]">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} onClick={() => openTransactionDetail(transaction)} className="cursor-pointer border-[#e5ebe7] hover:bg-[#006948]/5">
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
                          <Button variant="outline" size="sm" className="text-red-700" onClick={(event) => { event.stopPropagation(); voidTransaction(transaction); }} disabled={voidingId === transaction.id}>
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
    <Modal
      open={Boolean(selectedTransaction)}
      title={selectedTransaction ? shortOrderId(selectedTransaction.id) : t("Detail Transaksi")}
      description={selectedTransaction ? `${shortDate(selectedTransaction.createdAt)} • ${methodLabel(selectedTransaction.paymentMethod, language)}` : undefined}
      onClose={closeDetail}
    >
      {selectedTransaction ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">{t("Status")}</p>
              <Badge variant={statusVariant(selectedTransaction.status)} className="mt-1 normal-case tracking-normal">{statusLabel(selectedTransaction.status, language)}</Badge>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">{t("Kasir")}</p>
              <p className="mt-1 font-black text-[#0f172a]">{selectedTransaction.cashierName || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">{t("Metode")}</p>
              <p className="mt-1 font-black text-[#0f172a]">{methodLabel(selectedTransaction.paymentMethod, language)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">Ref</p>
              <p className="mt-1 break-all font-black text-[#0f172a]">{selectedTransaction.externalRef || "-"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#d9e3de] bg-white">
            <div className="border-b border-[#e6eee9] px-4 py-3 font-black text-[#0f172a]">{t("Barang")}</div>
            <div className="divide-y divide-[#edf2ef]">
              {(selectedTransaction.items || []).map((item) => (
                <div key={item.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-bold text-[#0f172a]">{item.name}</p>
                    <p className="text-xs font-semibold text-[#64748b]">SKU {item.sku || "-"} • {item.quantity} x {formatCurrency(item.price)}</p>
                    {item.discountAmount ? <p className="text-xs font-semibold text-primary">Diskon item {formatCurrency(item.discountAmount)} / pcs</p> : null}
                  </div>
                  <p className="font-black text-[#0f172a]">{formatCurrency(item.subtotal ?? item.price * item.quantity)}</p>
                </div>
              ))}
              {!selectedTransaction.items?.length ? <p className="px-4 py-3 text-sm font-semibold text-[#64748b]">-</p> : null}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-[#dbe6ef] bg-[#f8fafc] p-4 text-sm">
            {selectedTransaction.subtotal !== undefined ? <div className="flex justify-between gap-3"><span>Subtotal</span><span className="font-bold">{formatCurrency(selectedTransaction.subtotal)}</span></div> : null}
            {selectedTransaction.discountAmount ? <div className="flex justify-between gap-3 text-primary"><span>Diskon</span><span className="font-bold">-{formatCurrency(selectedTransaction.discountAmount)}</span></div> : null}
            <div className="flex justify-between gap-3 text-lg font-black text-[#0f172a]"><span>Total</span><span>{formatCurrency(selectedTransaction.total)}</span></div>
            {selectedTransaction.paidAmount !== null && selectedTransaction.paidAmount !== undefined ? <div className="flex justify-between gap-3"><span>Dibayar</span><span className="font-bold">{formatCurrency(selectedTransaction.paidAmount)}</span></div> : null}
            {selectedTransaction.changeAmount !== null && selectedTransaction.changeAmount !== undefined ? <div className="flex justify-between gap-3"><span>Kembalian</span><span className="font-bold">{formatCurrency(selectedTransaction.changeAmount)}</span></div> : null}
            <div className="flex justify-between gap-3"><span>{t("Laba")}</span><span className="font-bold">{formatCurrency(selectedTransaction.grossProfit ?? 0)}</span></div>
          </div>

          <div className="rounded-xl border border-[#d9e3de] bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label className="text-xs font-bold uppercase tracking-[0.16em] text-[#64748b]">{t("Ukuran Struk")}</Label>
                <select value={receiptPaperWidth} onChange={(event) => setReceiptPaperWidth(event.target.value as ReceiptPaperWidth)} className="mt-2 h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary">
                  <option value="58mm">58mm ({t("thermal kecil")})</option>
                  <option value="80mm">80mm ({t("thermal besar")})</option>
                </select>
              </div>
              <Button onClick={reprintSelectedReceipt} disabled={!selectedReceipt || receiptLoading || printing}>
                {printing || receiptLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Reprint
              </Button>
            </div>
            {!selectedTransaction.receiptToken ? <p className="mt-3 text-xs font-semibold text-amber-700">Struk lama tidak punya token reprint.</p> : null}
            {selectedTransaction.receiptToken && !selectedReceipt && !receiptLoading ? <p className="mt-3 text-xs font-semibold text-red-700">Struk tidak bisa dimuat.</p> : null}
            {selectedReceipt?.publicUrl ? (
              <a href={selectedReceipt.publicUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-sm font-bold text-primary">
                <ExternalLink className="mr-2 h-4 w-4" />
                Buka struk digital
              </a>
            ) : null}
          </div>

          {selectedTransaction.status === "success" ? (
            <Button variant="outline" className="w-full text-red-700" onClick={() => voidTransaction(selectedTransaction)} disabled={voidingId === selectedTransaction.id}>
              {voidingId === selectedTransaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Void Transaksi
            </Button>
          ) : null}
        </div>
      ) : null}
    </Modal>
    </>
  );
}
