"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Loader2, MessageCircle, PackageCheck, Printer, RefreshCw, Store } from "lucide-react";
import { api, apiFetch, type OnlineOrderRecord, type OnlineOrderStatus, type ReceiptRecord } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const statusLabel: Record<OnlineOrderStatus, string> = { pending_payment: "Menunggu pembayaran", paid: "Terbayar", processing: "Diproses", ready: "Siap diambil", completed: "Selesai", cancelled: "Dibatalkan", payment_failed: "Pembayaran gagal" };
const thermalServices = ["000018f0-0000-1000-8000-00805f9b34fb", "0000ff00-0000-1000-8000-00805f9b34fb", "49535343-fe7d-4ae5-8fa9-9fafd205e455", "e7810a71-73ae-499d-8c15-faa9aef0c3f2"];

function whatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}
function receiptText(receipt: ReceiptRecord) {
  return ["PESANAN ONLINE", receipt.shop.name, receipt.transaction.invoiceNumber, `Pemesan: ${receipt.onlineOrder?.customerName || "-"}`, `WhatsApp: ${receipt.onlineOrder?.customerPhone || "-"}`, "-------------------------------", ...receipt.items.map((item) => `${item.name} x${item.quantity}  ${formatCurrency(item.price * item.quantity)}`), "-------------------------------", `TOTAL ${formatCurrency(receipt.transaction.total)}`, "AMBIL DI TOKO", ""].join("\n");
}

export function OnlineOrderDashboard() {
  const [orders, setOrders] = useState<OnlineOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const attempted = useRef(new Set<string>());

  const printReceipt = useCallback(async (order: OnlineOrderRecord, automatic = false) => {
    if (!order.receipt) return false;
    const bluetooth = (navigator as Navigator & { bluetooth?: { getDevices?: () => Promise<Array<{ gatt?: { connect: () => Promise<{ getPrimaryServices: () => Promise<Array<{ getCharacteristics: () => Promise<Array<{ properties?: { write?: boolean; writeWithoutResponse?: boolean }; writeValue: (value: BufferSource) => Promise<void>; writeValueWithoutResponse?: (value: BufferSource) => Promise<void> }>> }>> }> } }>>; requestDevice: (options: unknown) => Promise<{ gatt?: { connect: () => Promise<{ getPrimaryServices: () => Promise<Array<{ getCharacteristics: () => Promise<Array<{ properties?: { write?: boolean; writeWithoutResponse?: boolean }; writeValue: (value: BufferSource) => Promise<void>; writeValueWithoutResponse?: (value: BufferSource) => Promise<void> }>> }>> }> } }> } }).bluetooth;
    if (!bluetooth) return false;
    try {
      const permitted = bluetooth.getDevices ? await bluetooth.getDevices() : [];
      const device = permitted[0] ?? (automatic ? null : await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: thermalServices }));
      if (!device?.gatt) return false;
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let writer: Awaited<ReturnType<(typeof services)[number]["getCharacteristics"]>>[number] | null = null;
      for (const service of services) { const found = (await service.getCharacteristics()).find((row) => row.properties?.writeWithoutResponse || row.properties?.write); if (found) { writer = found; break; } }
      if (!writer) return false;
      const payload = new TextEncoder().encode(`\x1b@\x1ba\x01${receiptText(order.receipt)}\n\n\x1dV\x00`);
      for (let index = 0; index < payload.length; index += 20) {
        const chunk = payload.slice(index, index + 20);
        if (writer.properties?.writeWithoutResponse && writer.writeValueWithoutResponse) await writer.writeValueWithoutResponse(chunk); else await writer.writeValue(chunk);
      }
      await api.onlineOrders.markPrinted(order.id);
      return true;
    } catch (err) {
      const message = String((err as { message?: unknown })?.message ?? err ?? "");
      if (!/cancel+ed|chooser|NotFoundError|AbortError/i.test(message)) setError("Printer pesanan online belum terhubung. Hubungkan printer dari Pengaturan Struk atau gunakan tombol Print.");
      return false;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      let [rows, me] = await Promise.all([api.onlineOrders.list(), api.me()]);
      const pending = rows.filter((order) => order.status === "pending_payment").slice(0, 12);
      if (pending.length > 0) {
        await Promise.allSettled(pending.map((order) => apiFetch(`/api/store/orders/${order.publicToken}`)));
        rows = await api.onlineOrders.list();
      }
      setOrders(rows); setShopId(me.shop?.onlineStoreSlug || me.shop?.id || null); setError(null);
      for (const order of rows) {
        if (!order.printedAt && order.status === "paid" && order.receipt?.settings.autoPrint && !attempted.current.has(order.id)) {
          attempted.current.add(order.id);
          const printed = await printReceipt(order, true);
          if (printed && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Pesanan online terbayar", { body: `${order.customerName} • ${formatCurrency(order.transaction.total)}`, tag: `online-order-${order.id}` });
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat pesanan online"); }
    finally { setLoading(false); }
  }, [printReceipt]);
  useEffect(() => { void load(); const timer = window.setInterval(load, 10_000); return () => window.clearInterval(timer); }, [load]);

  async function update(order: OnlineOrderRecord, status: "processing" | "ready" | "completed") { try { await api.onlineOrders.updateStatus(order.id, status); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Gagal memperbarui status"); } }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Pesanan Online</h2><p className="text-sm text-slate-500">QRIS KasirKita • Ambil di toko</p></div><div className="flex gap-2">{shopId ? <a href={`/store/${shopId}`} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Buka Toko Online</Button></a> : null}<Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div></div>{error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : null}{orders.length === 0 ? <Card><CardContent className="p-10 text-center"><Store className="mx-auto h-12 w-12 text-slate-300" /><p className="mt-3 font-bold">Belum ada pesanan online.</p>{shopId ? <p className="mt-1 text-sm text-slate-500">Bagikan link toko: /store/{shopId}</p> : null}</CardContent></Card> : <div className="grid gap-4 xl:grid-cols-2">{orders.map((order) => <Card key={order.id} className="bg-white"><CardContent className="space-y-5 p-7 pt-7 sm:pt-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Pesanan Online</p><p className="mt-1 font-mono text-xs font-bold text-slate-500">Order ID: {order.orderNumber}</p><h3 className="text-xl font-black">{order.customerName}</h3><p className="text-sm text-slate-500">{order.customerPhone} • {order.customerEmail}</p></div><Badge variant={order.status === "completed" ? "success" : order.status === "payment_failed" || order.status === "cancelled" ? "danger" : "warning"} className="normal-case tracking-normal">{statusLabel[order.status]}</Badge></div><div className="rounded-xl bg-slate-50 p-4 text-sm">{order.items.map((item) => <div key={item.id} className="flex justify-between py-1"><span>{item.name} × {item.quantity}</span><b>{formatCurrency(item.subtotal)}</b></div>)}<div className="mt-2 flex justify-between border-t pt-3 text-base font-black"><span>Total</span><span>{formatCurrency(order.transaction.total)}</span></div></div><div className="flex flex-wrap gap-2"><a href={`https://wa.me/${whatsapp(order.customerPhone)}?text=${encodeURIComponent(`Halo ${order.customerName}, pesanan online Anda di KasirKita ${statusLabel[order.status].toLowerCase()}.`)}`} target="_blank" rel="noreferrer"><Button variant="outline"><MessageCircle className="mr-2 h-4 w-4" />Hubungi Customer</Button></a>{order.receipt ? <Button variant="outline" onClick={() => void printReceipt(order)}><Printer className="mr-2 h-4 w-4" />Print</Button> : null}{order.status === "paid" ? <Button onClick={() => update(order, "processing")}><Clock className="mr-2 h-4 w-4" />Proses Pesanan</Button> : null}{order.status === "processing" ? <Button onClick={() => update(order, "ready")}><PackageCheck className="mr-2 h-4 w-4" />Siap Diambil</Button> : null}{order.status === "ready" ? <Button onClick={() => update(order, "completed")}><CheckCircle2 className="mr-2 h-4 w-4" />Pesanan Selesai</Button> : null}</div></CardContent></Card>)}</div>}</div>;
}
