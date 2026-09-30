"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, MessageCircle, Minus, Plus, Search, ShoppingBag, Store, WalletCards, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { bulkPriceTotal } from "@/lib/bulk-pricing";

type StoreData = {
  shop: { id: string; name: string; address?: string | null; phone?: string | null };
  products: Array<{ id: string; sku: string; name: string; price: number; discountType: "none" | "percent" | "amount"; discountValue: number; bulkPrices?: { quantity: number; total: number }[]; stock?: number | null; photoUrl?: string | null }>;
  isOpen: boolean;
};
type CheckoutResult = { orderToken: string; total: number; payment: { qrImageDataUrl?: string; paymentUrl: string; totalPayment?: number; fee?: number; expiredAt?: string | null; pollEveryMs: number } };
type OrderStatus = { order: { status: string; invoiceEmailSent: boolean }; transaction: { total: number; receiptUrl?: string | null }; shop: StoreData["shop"]; items: Array<{ name: string; quantity: number; subtotal: number }> };

function sellingPrice(product: StoreData["products"][number]) {
  if (product.discountType === "percent") return Math.max(0, Math.round(product.price * (1 - Math.min(product.discountValue, 100) / 100)));
  if (product.discountType === "amount") return Math.max(0, product.price - product.discountValue);
  return product.price;
}

function whatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function OnlineStorefront({ shopId }: { shopId: string }) {
  const [data, setData] = useState<StoreData | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  useEffect(() => {
    apiFetch<StoreData>(`/api/store/${shopId}`).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Toko tidak tersedia")).finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => {
    if (!checkout || status?.order.status === "paid" || status?.order.status === "processing" || status?.order.status === "ready" || status?.order.status === "completed") return;
    const poll = async () => { try { setStatus(await apiFetch<OrderStatus>(`/api/store/orders/${checkout.orderToken}`)); } catch { /* retry */ } };
    void poll();
    const timer = window.setInterval(poll, checkout.payment.pollEveryMs || 3000);
    return () => window.clearInterval(timer);
  }, [checkout, status?.order.status]);

  const selected = useMemo(() => data?.products.filter((product) => (cart[product.id] ?? 0) > 0) ?? [], [cart, data]);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.products ?? [];
    return data?.products.filter((product) => product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)) ?? [];
  }, [data, search]);
  const itemCount = selected.reduce((sum, product) => sum + (cart[product.id] ?? 0), 0);
  const total = selected.reduce((sum, product) => sum + bulkPriceTotal(sellingPrice(product), cart[product.id] ?? 0, product.bulkPrices), 0);
  const canCheckout = total > 0 && name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email) && phone.replace(/\D/g, "").length >= 8 && Boolean(turnstileToken);

  function quantity(product: StoreData["products"][number], delta: number) {
    setCart((current) => ({ ...current, [product.id]: Math.max(0, Math.min(product.stock ?? 100, (current[product.id] ?? 0) + delta)) }));
  }

  async function createOrder() {
    if (!data?.isOpen) return setError("Toko sedang tutup. Pembayaran tidak dapat dilakukan.");
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<CheckoutResult>(`/api/store/${shopId}/checkout`, {
        method: "POST",
        body: JSON.stringify({ customerName: name, customerEmail: email, customerPhone: phone, items: selected.map((product) => ({ productId: product.id, quantity: cart[product.id] })), turnstileToken }),
      });
      setCheckout(result);
      setCheckoutOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout gagal");
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
  if (!data) return <main className="mx-auto flex min-h-screen max-w-xl items-center p-6"><div className="w-full rounded-3xl border bg-white p-8 text-center"><Store className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-4 text-2xl font-black">Toko tidak tersedia</h1><p className="mt-2 text-red-600">{error}</p></div></main>;

  if (!data.isOpen) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8f6] p-6"><div className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-xl"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100"><Store className="h-10 w-10 text-slate-500" /></div><p className="mt-5 text-xs font-bold uppercase tracking-widest text-primary">Toko Online KasirKita</p><h1 className="mt-1 text-3xl font-black">{data.shop.name}</h1><div className="mx-auto mt-5 inline-flex rounded-full bg-slate-200 px-5 py-2 text-sm font-black text-slate-700">Toko sedang tutup</div><p className="mx-auto mt-4 max-w-md text-slate-600">Toko ini belum menerima pesanan online. Produk dan pembayaran akan tersedia kembali saat toko dibuka.</p>{data.shop.address ? <p className="mt-5 text-sm text-slate-500"><MapPin className="mr-1 inline h-4 w-4" />{data.shop.address}</p> : null}{data.shop.phone ? <a className="mt-6 inline-flex items-center rounded-xl border border-primary px-5 py-3 font-bold text-primary" href={`https://wa.me/${whatsapp(data.shop.phone)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Hubungi Toko</a> : null}</div></main>;
  }

  const paid = status && ["paid", "processing", "ready", "completed"].includes(status.order.status);
  if (paid) return <main className="mx-auto flex min-h-screen max-w-xl items-center p-6"><div className="w-full rounded-3xl border bg-white p-8 text-center shadow-xl"><CheckCircle2 className="mx-auto h-20 w-20 text-primary" /><h1 className="mt-5 text-3xl font-black">Pembayaran berhasil</h1><p className="mt-3 text-slate-600">Pesanan Anda sudah masuk ke {data.shop.name} dan akan diproses untuk diambil di toko.</p><p className="mt-4 text-3xl font-black text-primary">{formatCurrency(status.transaction.total)}</p><div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Invoice/struk dikirim ke <b>{email}</b>. Periksa folder Spam jika belum terlihat.</div><div className="mt-5 flex flex-wrap justify-center gap-3">{status.transaction.receiptUrl ? <a className="inline-flex rounded-xl border border-primary px-5 py-3 font-bold text-primary" href={status.transaction.receiptUrl}>Lihat struk digital</a> : null}{data.shop.phone ? <a className="inline-flex items-center rounded-xl bg-primary px-5 py-3 font-bold text-white" href={`https://wa.me/${whatsapp(data.shop.phone)}?text=${encodeURIComponent(`Halo ${data.shop.name}, saya sudah membayar pesanan online atas nama ${name} senilai ${formatCurrency(status.transaction.total)}. Mohon dicek, terima kasih.`)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Hubungi Toko</a> : null}</div><p className="mt-6 text-sm text-slate-500"><MapPin className="mr-1 inline h-4 w-4" />Ambil di toko: {data.shop.address || data.shop.name}</p></div></main>;

  if (status && ["payment_failed", "cancelled"].includes(status.order.status)) return <main className="mx-auto flex min-h-screen max-w-xl items-center p-6"><div className="w-full rounded-3xl border bg-white p-8 text-center shadow-xl"><h1 className="text-3xl font-black">Pembayaran tidak selesai</h1><p className="mt-3 text-slate-600">Invoice QRIS sudah kedaluwarsa atau dibatalkan. Silakan buat pesanan baru.</p><Button className="mt-6" onClick={() => window.location.reload()}>Kembali ke toko</Button></div></main>;

  if (checkout) return <main className="mx-auto min-h-screen max-w-xl p-6"><div className="rounded-3xl border bg-white p-7 text-center shadow-xl"><WalletCards className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-3 text-2xl font-black">Bayar dengan QRIS KasirKita</h1><p className="mt-2 text-slate-600">Pesanan hanya untuk ambil di toko.</p>{checkout.payment.qrImageDataUrl ? <img src={checkout.payment.qrImageDataUrl} alt="QRIS pembayaran" className="mx-auto mt-5 h-64 w-64 rounded-2xl border object-contain" /> : null}<p className="mt-4 text-3xl font-black text-primary">{formatCurrency(checkout.payment.totalPayment ?? checkout.total)}</p>{checkout.payment.paymentUrl ? <a href={checkout.payment.paymentUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white">Buka halaman pembayaran</a> : null}<p className="mt-5 text-sm text-slate-500">Status pembayaran diperiksa otomatis. Jangan tutup halaman ini sampai pembayaran terkonfirmasi.</p>{error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}</div></main>;

  const checkoutForm = <>
    <h2 className="text-xl font-black">Checkout Pesanan</h2>
    <p className="mt-1 text-sm text-slate-500">Pembayaran hanya QRIS KasirKita • Ambil di toko</p>
    <div className="mt-5 space-y-3">{selected.length ? selected.map((product) => <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="truncate font-bold text-slate-950" title={product.name}>{product.name}</p><div className="mt-3 flex items-end justify-between gap-4"><div className="flex items-center gap-2"><button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white transition hover:border-primary hover:text-primary" onClick={() => quantity(product, -1)} aria-label={`Kurangi ${product.name}`}><Minus className="h-4 w-4" /></button><span className="flex h-10 min-w-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 font-black">{cart[product.id]}</span><button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white transition hover:border-primary hover:text-primary" onClick={() => quantity(product, 1)} aria-label={`Tambah ${product.name}`}><Plus className="h-4 w-4" /></button></div><div className="text-right"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Subtotal</p><p className="mt-0.5 font-black text-slate-950">{formatCurrency(bulkPriceTotal(sellingPrice(product), cart[product.id], product.bulkPrices))}</p></div></div></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Pilih produk terlebih dahulu.</p>}</div>
    <div className="my-5 flex justify-between border-y py-4 text-lg font-black"><span>Total</span><span>{formatCurrency(total)}</span></div>
    <div className="space-y-4"><div><Label>Nama pemesan</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required /></div><div><Label>Email untuk invoice</Label><Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div><Label>Nomor WhatsApp</Label><Input className="mt-1" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" required /></div><div><Label>Verifikasi keamanan</Label><div className="mt-2"><TurnstileWidget onVerify={setTurnstileToken} resetSignal={turnstileReset} /></div></div></div>
    {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <Button className="mt-5 w-full" disabled={submitting || !canCheckout} onClick={createOrder}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WalletCards className="mr-2 h-4 w-4" />}Bayar QRIS KasirKita</Button>
  </>;

  return <main className="min-h-screen bg-[#f5f8f6] pb-28 lg:pb-0">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Toko Online KasirKita</p><h1 className="text-2xl font-black">{data.shop.name}</h1><p className="text-sm text-slate-500"><MapPin className="mr-1 inline h-4 w-4" />{data.shop.address || "Ambil di toko"}</p></div><div className="shrink-0 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-primary"><ShoppingBag className="mr-2 inline h-4 w-4" />{itemCount} item</div></div></header>
    <div className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-[1fr_380px]">
      <section>
        <div className="relative mb-5"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input className="h-12 bg-white pl-12 pr-11 shadow-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama produk atau SKU..." aria-label="Cari produk" />{search ? <button type="button" aria-label="Hapus pencarian" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button> : null}</div>
        {visibleProducts.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex h-36 items-center justify-center bg-slate-100">{product.photoUrl ? <img src={product.photoUrl} alt={product.name} className="h-full w-full object-cover" /> : <Store className="h-12 w-12 text-slate-300" />}</div><div className="p-4"><h2 className="font-black">{product.name}</h2><p className="mt-1 text-lg font-black text-primary">{formatCurrency(sellingPrice(product))}</p><p className="text-xs text-slate-500">Stok {product.stock ?? "tersedia"}</p>{product.bulkPrices?.length ? <p className="mt-1 text-xs font-semibold text-emerald-700">{[...product.bulkPrices].sort((a, b) => a.quantity - b.quantity).map((offer) => `${offer.quantity} pcs ${formatCurrency(offer.total)}`).join(" · ")}</p> : null}<div className="mt-4 flex items-center justify-between"><button className="rounded-lg border p-2" onClick={() => quantity(product, -1)} aria-label={`Kurangi ${product.name}`}><Minus className="h-4 w-4" /></button><b>{cart[product.id] ?? 0}</b><button className="rounded-lg border p-2" onClick={() => quantity(product, 1)} aria-label={`Tambah ${product.name}`}><Plus className="h-4 w-4" /></button></div></div></article>)}</div> : <div className="rounded-2xl border bg-white p-10 text-center text-slate-500"><Search className="mx-auto mb-3 h-8 w-8" /><p className="font-bold">Produk tidak ditemukan</p><p className="mt-1 text-sm">Coba kata pencarian lain.</p></div>}
      </section>
      <aside className="hidden h-fit rounded-3xl border bg-white p-5 shadow-sm lg:sticky lg:top-5 lg:block">{checkoutForm}</aside>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-4 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden"><Button className="h-12 w-full" onClick={() => setCheckoutOpen(true)}><ShoppingBag className="mr-2 h-5 w-5" />Checkout · {itemCount} item · {formatCurrency(total)}</Button></div>
    {checkoutOpen ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden" role="dialog" aria-modal="true" aria-label="Checkout pesanan" onClick={() => setCheckoutOpen(false)}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex justify-end"><button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-full bg-slate-100 p-2" aria-label="Tutup checkout"><X className="h-5 w-5" /></button></div>{checkoutForm}</div></div> : null}
  </main>;
}
