"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Minus, Plus, ShoppingBag, Store, WalletCards } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StoreData = { shop: { id: string; name: string; address?: string | null; phone?: string | null }; products: Array<{ id: string; sku: string; name: string; price: number; discountType: "none" | "percent" | "amount"; discountValue: number; stock?: number | null; photoUrl?: string | null }> };
type CheckoutResult = { orderToken: string; total: number; payment: { qrImageDataUrl?: string; paymentUrl: string; totalPayment?: number; fee?: number; expiredAt?: string | null; pollEveryMs: number } };
type OrderStatus = { order: { status: string; invoiceEmailSent: boolean }; transaction: { total: number; receiptUrl?: string | null }; shop: StoreData["shop"]; items: Array<{ name: string; quantity: number; subtotal: number }> };

function sellingPrice(product: StoreData["products"][number]) {
  if (product.discountType === "percent") return Math.max(0, Math.round(product.price * (1 - Math.min(product.discountValue, 100) / 100)));
  if (product.discountType === "amount") return Math.max(0, product.price - product.discountValue);
  return product.price;
}

export function OnlineStorefront({ shopId }: { shopId: string }) {
  const [data, setData] = useState<StoreData | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);

  useEffect(() => { apiFetch<StoreData>(`/api/store/${shopId}`).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Toko tidak tersedia")).finally(() => setLoading(false)); }, [shopId]);
  useEffect(() => {
    if (!checkout || status?.order.status === "paid" || status?.order.status === "processing" || status?.order.status === "ready" || status?.order.status === "completed") return;
    const poll = async () => { try { setStatus(await apiFetch<OrderStatus>(`/api/store/orders/${checkout.orderToken}`)); } catch { /* retry */ } };
    void poll();
    const timer = window.setInterval(poll, checkout.payment.pollEveryMs || 3000);
    return () => window.clearInterval(timer);
  }, [checkout, status?.order.status]);

  const selected = useMemo(() => data?.products.filter((product) => (cart[product.id] ?? 0) > 0) ?? [], [cart, data]);
  const total = selected.reduce((sum, product) => sum + sellingPrice(product) * (cart[product.id] ?? 0), 0);
  function quantity(product: StoreData["products"][number], delta: number) { setCart((current) => ({ ...current, [product.id]: Math.max(0, Math.min(product.stock ?? 100, (current[product.id] ?? 0) + delta)) })); }
  async function createOrder() {
    setError(null); setSubmitting(true);
    try {
      const result = await apiFetch<CheckoutResult>(`/api/store/${shopId}/checkout`, { method: "POST", body: JSON.stringify({ customerName: name, customerEmail: email, customerPhone: phone, items: selected.map((product) => ({ productId: product.id, quantity: cart[product.id] })) }) });
      setCheckout(result);
    } catch (err) { setError(err instanceof Error ? err.message : "Checkout gagal"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
  if (!data) return <main className="mx-auto flex min-h-screen max-w-xl items-center p-6"><div className="w-full rounded-3xl border bg-white p-8 text-center"><Store className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-4 text-2xl font-black">Toko tidak tersedia</h1><p className="mt-2 text-red-600">{error}</p></div></main>;

  const paid = status && ["paid", "processing", "ready", "completed"].includes(status.order.status);
  if (paid) return <main className="mx-auto flex min-h-screen max-w-xl items-center p-6"><div className="w-full rounded-3xl border bg-white p-8 text-center shadow-xl"><CheckCircle2 className="mx-auto h-20 w-20 text-primary" /><h1 className="mt-5 text-3xl font-black">Pembayaran berhasil</h1><p className="mt-3 text-slate-600">Pesanan Anda sudah masuk ke {data.shop.name} dan akan diproses untuk diambil di toko.</p><p className="mt-4 text-3xl font-black text-primary">{formatCurrency(status.transaction.total)}</p><div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Invoice/struk dikirim ke <b>{email}</b>. Periksa folder Spam jika belum terlihat.</div>{status.transaction.receiptUrl ? <a className="mt-5 inline-flex rounded-xl border border-primary px-5 py-3 font-bold text-primary" href={status.transaction.receiptUrl}>Lihat struk digital</a> : null}<p className="mt-6 text-sm text-slate-500"><MapPin className="mr-1 inline h-4 w-4" />Ambil di toko: {data.shop.address || data.shop.name}</p></div></main>;

  if (status && ["payment_failed", "cancelled"].includes(status.order.status)) return <main className="mx-auto flex min-h-screen max-w-xl items-center p-6"><div className="w-full rounded-3xl border bg-white p-8 text-center shadow-xl"><h1 className="text-3xl font-black">Pembayaran tidak selesai</h1><p className="mt-3 text-slate-600">Invoice QRIS sudah kedaluwarsa atau dibatalkan. Silakan buat pesanan baru.</p><Button className="mt-6" onClick={() => window.location.reload()}>Kembali ke toko</Button></div></main>;

  if (checkout) return <main className="mx-auto min-h-screen max-w-xl p-6"><div className="rounded-3xl border bg-white p-7 text-center shadow-xl"><WalletCards className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-3 text-2xl font-black">Bayar dengan QRIS KasirKita</h1><p className="mt-2 text-slate-600">Pesanan hanya untuk ambil di toko.</p>{checkout.payment.qrImageDataUrl ? <img src={checkout.payment.qrImageDataUrl} alt="QRIS pembayaran" className="mx-auto mt-5 h-64 w-64 rounded-2xl border object-contain" /> : null}<p className="mt-4 text-3xl font-black text-primary">{formatCurrency(checkout.payment.totalPayment ?? checkout.total)}</p>{checkout.payment.paymentUrl ? <a href={checkout.payment.paymentUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white">Buka halaman pembayaran</a> : null}<p className="mt-5 text-sm text-slate-500">Status pembayaran diperiksa otomatis. Jangan tutup halaman ini sampai pembayaran terkonfirmasi.</p>{error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}</div></main>;

  return <main className="min-h-screen bg-[#f5f8f6]"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Toko Online KasirKita</p><h1 className="text-2xl font-black">{data.shop.name}</h1><p className="text-sm text-slate-500"><MapPin className="mr-1 inline h-4 w-4" />{data.shop.address || "Ambil di toko"}</p></div><div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-primary"><ShoppingBag className="mr-2 inline h-4 w-4" />{selected.length} produk</div></div></header><div className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-[1fr_380px]"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex h-36 items-center justify-center bg-slate-100">{product.photoUrl ? <img src={product.photoUrl} alt={product.name} className="h-full w-full object-cover" /> : <Store className="h-12 w-12 text-slate-300" />}</div><div className="p-4"><h2 className="font-black">{product.name}</h2><p className="mt-1 text-lg font-black text-primary">{formatCurrency(sellingPrice(product))}</p><p className="text-xs text-slate-500">Stok {product.stock ?? "tersedia"}</p><div className="mt-4 flex items-center justify-between"><button className="rounded-lg border p-2" onClick={() => quantity(product, -1)}><Minus className="h-4 w-4" /></button><b>{cart[product.id] ?? 0}</b><button className="rounded-lg border p-2" onClick={() => quantity(product, 1)}><Plus className="h-4 w-4" /></button></div></div></article>)}</section><aside className="h-fit rounded-3xl border bg-white p-5 shadow-sm lg:sticky lg:top-5"><h2 className="text-xl font-black">Checkout Pesanan</h2><p className="mt-1 text-sm text-slate-500">Pembayaran hanya QRIS KasirKita • Ambil di toko</p><div className="mt-5 space-y-3">{selected.map((product) => <div key={product.id} className="flex justify-between text-sm"><span>{product.name} × {cart[product.id]}</span><b>{formatCurrency(sellingPrice(product) * cart[product.id])}</b></div>)}</div><div className="my-5 flex justify-between border-y py-4 text-lg font-black"><span>Total</span><span>{formatCurrency(total)}</span></div><div className="space-y-4"><div><Label>Nama pemesan</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required /></div><div><Label>Email untuk invoice</Label><Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div><Label>Nomor WhatsApp</Label><Input className="mt-1" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" required /></div></div>{error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<Button className="mt-5 w-full" disabled={submitting || total <= 0 || name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email) || phone.replace(/\D/g, "").length < 8} onClick={createOrder}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WalletCards className="mr-2 h-4 w-4" />}Bayar QRIS KasirKita</Button></aside></div></main>;
}
