"use client";

import { useEffect, useMemo, useState } from "react";
import { Barcode, CheckCircle2, Clock, CreditCard, Loader2, Minus, NotebookPen, PackagePlus, Plus, QrCode, ShoppingCart, SlidersHorizontal, Trash2, WalletCards } from "lucide-react";
import { api, type CheckoutItem, type CheckoutResponse, type PaymentMethod, type ProductRecord } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CartItem = ProductRecord & { qty: number; isManual?: boolean };
type ModalMethod = PaymentMethod | null;

type PaymentStatus = "idle" | "waiting" | "paid" | "failed";

const methodLabel: Record<PaymentMethod, string> = {
  cash: "Tunai (Cash)",
  qris_static: "QRIS Statis UMKM",
  qris_pakasir: "QRIS Pakasir Dinamis",
  debt: "Catat Hutang Pelanggan",
};

const emptyManualItem = {
  name: "",
  sku: "",
  price: "",
  quantity: "1",
};

export function PosInterface() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [shopName, setShopName] = useState("UMKM Berkah");
  const [shopQrisImage, setShopQrisImage] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<ModalMethod>(null);
  const [cashReceived, setCashReceived] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [pakasirPayment, setPakasirPayment] = useState<CheckoutResponse["payment"] | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [debtNote, setDebtNote] = useState("");
  const [manualItemOpen, setManualItemOpen] = useState(false);
  const [manualItem, setManualItem] = useState(emptyManualItem);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successSummary, setSuccessSummary] = useState<{ method: PaymentMethod; total: number; totalItems: number } | null>(null);

  const categories = useMemo(() => ["Semua", "Stok Rendah", "Terbaru"], []);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const [rows, me] = await Promise.all([api.products.list(), api.me().catch(() => null)]);
      setProducts(rows.filter((product) => product.isActive !== false));
      if (me?.shop?.name) setShopName(me.shop.name);
      setShopQrisImage(me?.shop?.qrisStaticImageUrl ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (paymentMethod !== "qris_pakasir" || !pakasirPayment?.reference || paymentStatus !== "waiting") return;

    const timer = window.setInterval(async () => {
      try {
        const result = await api.pollPakasir(pakasirPayment.reference);
        if (result.status === "paid") {
          setPaymentStatus("paid");
          showCheckoutSuccess("qris_pakasir");
        } else if (result.status === "failed" || result.status === "cancelled") {
          setPaymentStatus("failed");
          setError("Pembayaran Pakasir gagal atau dibatalkan.");
        }
      } catch (err) {
        setPaymentStatus("failed");
        setError(err instanceof Error ? err.message : "Gagal polling status Pakasir");
      }
    }, pakasirPayment.pollEveryMs || 3000);

    return () => window.clearInterval(timer);
  }, [pakasirPayment, paymentMethod, paymentStatus]);

  const filteredProducts = useMemo(() => {
    const keyword = query.toLowerCase().trim();
    return products.filter((product) => {
      const lowStock = (product.stock ?? 0) > 0 && (product.stock ?? 0) < 8;
      const matchCategory = category === "Semua" || (category === "Stok Rendah" ? lowStock : true);
      const matchQuery = !keyword || product.name.toLowerCase().includes(keyword) || product.sku.toLowerCase().includes(keyword) || product.shopName?.toLowerCase().includes(keyword);
      return matchCategory && matchQuery;
    });
  }, [query, category, products]);

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal;
  const change = Math.max(cashReceived - total, 0);

  function addToCart(product: ProductRecord, quantity = 1) {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + safeQuantity } : item);
      return [...current, { ...product, qty: safeQuantity }];
    });
  }

  function addManualItem() {
    const name = manualItem.name.trim();
    const price = Number(manualItem.price);
    const quantity = Math.max(1, Number(manualItem.quantity));

    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity)) {
      setError("Isi nama item, harga, dan quantity manual dengan benar.");
      return;
    }

    const id = `manual-${Date.now()}`;
    const sku = manualItem.sku.trim() || `MANUAL-${Date.now().toString().slice(-6)}`;

    setCart((current) => [
      ...current,
      {
        id,
        sku,
        name,
        price: Math.round(price),
        costPrice: 0,
        stock: null,
        photoUrl: null,
        isActive: true,
        isManual: true,
        qty: Math.floor(quantity),
      },
    ]);
    setManualItem({ ...emptyManualItem });
    setManualItemOpen(false);
    setError(null);
  }

  function updateQty(id: string, qty: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item];
      if (!Number.isFinite(qty) || qty <= 0) return [];
      return [{ ...item, qty: Math.floor(qty) }];
    }));
  }

  function handleSkuSubmit() {
    const exact = products.find((product) => product.sku.toLowerCase() === query.trim().toLowerCase());
    if (exact) {
      addToCart(exact);
      setQuery("");
      return;
    }

    if (query.trim()) {
      setManualItem((current) => ({ ...current, name: query.trim(), sku: query.trim().toUpperCase() }));
      setManualItemOpen(true);
    }
  }

  function itemsPayload(): CheckoutItem[] {
    return cart.map((item) => ({
      productId: item.isManual ? undefined : item.id,
      sku: item.sku,
      name: item.name,
      price: item.price,
      quantity: item.qty,
    }));
  }

  function resetTransaction() {
    setCart([]);
    setPaymentMethod(null);
    setCashReceived(0);
    setPaymentStatus("idle");
    setPakasirPayment(null);
    setCustomerName("");
    setCustomerPhone("");
    setDueDate("");
    setDebtNote("");
    setManualItem({ ...emptyManualItem });
    setManualItemOpen(false);
    setSubmitting(false);
  }

  function showCheckoutSuccess(method: PaymentMethod) {
    setSuccessSummary({ method, total, totalItems });
    setSuccessOpen(true);
    setPaymentMethod(null);
    setSubmitting(false);
    window.setTimeout(() => {
      resetTransaction();
      setSuccessOpen(false);
    }, 1900);
  }

  async function openPayment(method: PaymentMethod) {
    if (cart.length === 0) return;
    setError(null);
    setPaymentMethod(method);
    setPaymentStatus(method === "qris_pakasir" ? "waiting" : "idle");
    setPakasirPayment(null);

    if (method === "qris_pakasir") {
      setSubmitting(true);
      try {
        const result = await api.checkout({ paymentMethod: "qris_pakasir", items: itemsPayload() });
        setPakasirPayment(result.payment ?? null);
      } catch (err) {
        setPaymentStatus("failed");
        setError(err instanceof Error ? err.message : "Gagal membuat transaksi Pakasir");
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function completeCheckout(method: Exclude<PaymentMethod, "qris_pakasir">) {
    setSubmitting(true);
    setError(null);
    try {
      await api.checkout({
        paymentMethod: method,
        paidAmount: method === "cash" ? cashReceived : undefined,
        customerName: method === "debt" ? customerName : undefined,
        customerPhone: method === "debt" ? customerPhone : undefined,
        debtDueDate: method === "debt" ? dueDate : undefined,
        note: method === "debt" ? debtNote : undefined,
        items: itemsPayload(),
      });
      setPaymentStatus("paid");
      showCheckoutSuccess(method);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
      setPaymentStatus("failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-[#f8f9ff] lg:h-full lg:min-h-0 lg:flex-row">
      <section className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1 lg:border-r lg:border-[#bccac0]">
        <div className="flex items-center justify-between border-b border-[#bccac0] bg-white px-4 py-3 lg:px-6 lg:py-4">
          <div>
            <h2 className="text-xl font-extrabold text-primary">{shopName}</h2>
            <p className="text-xs text-[#3d4a42]">POS Kasir • Produk dari database</p>
          </div>
          <div className="hidden items-center gap-3 text-sm font-semibold text-primary md:flex">
            <WalletCards className="h-5 w-5" /> API Checkout Aktif
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-visible p-4 custom-scrollbar lg:overflow-auto lg:p-6">
          {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <div className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:gap-4">
            <div className="relative flex-1">
              <Barcode className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-[#3d4a42]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" ? handleSkuSubmit() : undefined}
                className="h-12 border-[#bccac0] bg-[#eff4ff] pl-12 text-base shadow-[0_0_0_1px_rgba(0,105,72,0.12)] lg:h-14 lg:text-lg"
                placeholder="Scan SKU atau Cari Produk..."
                autoFocus
              />
            </div>
            <Button variant="outline" size="lg" className="h-12 shrink-0 px-4 text-[#0b1c30] lg:h-14 lg:px-6" onClick={() => setManualItemOpen(true)}>
              <PackagePlus className="mr-2 h-5 w-5" /> Add Item
            </Button>
            <Button variant="secondary" size="lg" className="h-12 shrink-0 px-4 text-[#0b1c30] lg:h-14 lg:px-6" onClick={loadProducts}>
              <SlidersHorizontal className="mr-2 h-5 w-5" /> Refresh Produk
            </Button>
          </div>


          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {categories.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={category === item ? "shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white" : "shrink-0 rounded-full bg-[#dae2fd] px-5 py-2.5 text-sm font-semibold text-[#3d4a42] hover:bg-[#d3e4fe]"}>{item}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-[#bccac0] bg-white text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat produk...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-[#bccac0] bg-white text-center text-sm text-[#3d4a42]">Belum ada produk. Tambahkan produk di halaman Inventaris, atau klik Add Item untuk item manual.</div>
          ) : (
            <div className="pos-grid">
              {filteredProducts.map((product) => {
                const cartQty = cart.find((item) => item.id === product.id)?.qty ?? 0;

                return (
                  <button key={product.id} onClick={() => addToCart(product)} className="group overflow-hidden rounded-xl border border-[#bccac0] bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(33,49,69,0.10)] active:scale-[0.98]">
                    <div className="relative h-28 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 sm:h-32 lg:h-36">
                      {product.photoUrl ? <img src={product.photoUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-black text-primary">KK</div>}
                      <Badge variant={(product.stock ?? 0) < 8 ? "danger" : "default"} className="absolute right-3 top-3 normal-case tracking-normal">Stok: {product.stock ?? "-"}</Badge>
                      {cartQty > 0 ? <Badge variant="success" className="absolute left-3 top-3 normal-case tracking-normal">Di cart: {cartQty}</Badge> : null}
                    </div>
                    <div className="p-3 lg:p-4">
                      <p className="line-clamp-2 min-h-[40px] text-sm font-semibold text-[#0b1c30] lg:min-h-[44px] lg:text-base">{product.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-base font-extrabold text-primary lg:text-lg">{formatCurrency(product.price)}</p>
                        <span className="rounded-full bg-[#eff4ff] px-2 py-1 text-[11px] font-semibold text-[#3d4a42]">SKU {product.sku.slice(-4)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="flex min-h-[360px] shrink-0 flex-col border-t border-[#bccac0] bg-white lg:h-full lg:max-h-none lg:w-[460px] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b border-[#bccac0] p-4 lg:p-6">
          <div className="flex items-center gap-3"><ShoppingCart className="h-6 w-6 text-primary" /><div><h3 className="text-xl font-bold">Keranjang</h3><p className="text-xs font-semibold text-[#3d4a42]">{totalItems} item • {cart.length} jenis barang</p></div></div>
          <button onClick={() => setCart([])} className="flex items-center gap-2 text-sm font-semibold text-red-600"><Trash2 className="h-4 w-4" /> Bersihkan</button>
        </div>

        <div className="max-h-[55vh] flex-1 overflow-auto p-4 custom-scrollbar lg:max-h-none lg:p-5">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#bccac0] bg-[#f8f9ff] text-center text-sm text-[#3d4a42]">Keranjang masih kosong. Klik kartu produk di kiri, scan SKU lalu Enter, atau tekan Add Item untuk menambahkan barang.</div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#bccac0] bg-[#f8f9ff] p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
                      {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-black text-primary">{item.isManual ? "ADD" : "KK"}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="truncate font-semibold">{item.name}</p>{item.isManual ? <Badge variant="warning" className="normal-case tracking-normal">Manual</Badge> : null}</div>
                      <p className="text-sm font-bold text-primary">{formatCurrency(item.price)} × {item.qty}</p>
                    </div>
                    <button onClick={() => updateQty(item.id, 0)} className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                    <div className="grid grid-cols-3 items-center gap-2 rounded-xl bg-white p-2">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} className="flex h-9 items-center justify-center rounded-lg border border-[#bccac0]"><Minus className="h-4 w-4" /></button>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(event) => updateQty(item.id, Number(event.target.value))}
                        className="h-9 px-2 text-center font-bold"
                        aria-label={`Quantity ${item.name}`}
                      />
                      <button onClick={() => updateQty(item.id, item.qty + 1)} className="flex h-9 items-center justify-center rounded-lg border border-[#bccac0]"><Plus className="h-4 w-4" /></button>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3d4a42]">Subtotal</p>
                      <p className="text-lg font-extrabold text-[#0b1c30]">{formatCurrency(item.price * item.qty)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#bccac0] bg-[#dce9ff] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:p-6">
          <div className="space-y-3 text-base">
            <div className="flex justify-between"><span>Total qty</span><span>{totalItems} item</span></div>
            <div className="flex justify-between"><span>Subtotal barang × qty</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="border-t border-[#bccac0] pt-3 flex justify-between font-extrabold"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
          </div>

          <div className="mt-6 grid gap-3">
            <Button size="lg" onClick={() => openPayment("cash")} disabled={cart.length === 0} className="w-full"><CreditCard className="mr-2 h-5 w-5" /> Tunai (Cash)</Button>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button size="lg" variant="outline" onClick={() => openPayment("qris_static")} disabled={cart.length === 0} className="px-3"><QrCode className="mr-2 h-4 w-4" /> QRIS Statis</Button>
              <Button size="lg" variant="outline" onClick={() => openPayment("qris_pakasir")} disabled={cart.length === 0} className="px-3"><WalletCards className="mr-2 h-4 w-4" /> QRIS Pakasir</Button>
            </div>
            <Button size="lg" variant="navy" onClick={() => openPayment("debt")} disabled={cart.length === 0} className="w-full"><NotebookPen className="mr-2 h-5 w-5" /> Catat Hutang</Button>
          </div>
        </div>
      </aside>

      <Modal open={manualItemOpen} title="Add Item Manual" description="Tambahkan item langsung ke keranjang tanpa harus terdaftar di inventaris." onClose={() => setManualItemOpen(false)}>
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nama item</Label>
              <Input value={manualItem.name} onChange={(event) => setManualItem((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Es batu tambahan" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>SKU / Kode opsional</Label>
              <Input value={manualItem.sku} onChange={(event) => setManualItem((current) => ({ ...current, sku: event.target.value }))} placeholder="Auto jika kosong" />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={manualItem.quantity} onChange={(event) => setManualItem((current) => ({ ...current, quantity: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Harga per item</Label>
              <Input type="number" min={0} value={manualItem.price} onChange={(event) => setManualItem((current) => ({ ...current, price: event.target.value }))} placeholder="Contoh 15000" />
            </div>
          </div>
          <div className="rounded-2xl bg-[#eff4ff] p-4">
            <p className="text-sm font-semibold text-[#3d4a42]">Subtotal manual</p>
            <p className="text-3xl font-extrabold text-primary">{formatCurrency((Number(manualItem.price) || 0) * (Number(manualItem.quantity) || 0))}</p>
            <p className="mt-1 text-xs text-[#3d4a42]">Rumus: harga per item × quantity.</p>
          </div>
          <Button className="w-full" size="lg" onClick={addManualItem}>
            <PackagePlus className="mr-2 h-5 w-5" /> Tambahkan ke Keranjang
          </Button>
        </div>
      </Modal>

      <Modal open={paymentMethod !== null} title={paymentMethod ? methodLabel[paymentMethod] : "Pembayaran"} description="Transaksi dikirim ke API route backend dan disimpan ke SQLite lokal." onClose={() => !submitting ? setPaymentMethod(null) : undefined}>
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

        {paymentMethod === "cash" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#eff4ff] p-4"><p className="text-sm text-[#3d4a42]">Total</p><p className="text-4xl font-extrabold text-primary">{formatCurrency(total)}</p></div>
            <div className="space-y-2"><Label>Uang diterima</Label><Input type="number" value={cashReceived || ""} onChange={(event) => setCashReceived(Number(event.target.value))} placeholder="Contoh 100000" /></div>
            <div className="rounded-2xl border border-[#bccac0] p-4"><p className="text-sm text-[#3d4a42]">Kembalian</p><p className="text-3xl font-extrabold text-primary">{formatCurrency(change)}</p></div>
            <Button className="w-full" size="lg" disabled={cashReceived < total || submitting} onClick={() => completeCheckout("cash")}>{submitting ? "Menyimpan..." : "Selesaikan Transaksi"}</Button>
          </div>
        ) : null}

        {paymentMethod === "qris_static" ? (
          <div className="space-y-4 text-center">
            <div className="receipt-grid mx-auto flex h-72 w-72 items-center justify-center overflow-hidden rounded-3xl border bg-white">
              {shopQrisImage ? (
                <img src={shopQrisImage} alt={`QRIS Statis ${shopName}`} className="h-full w-full object-contain p-4" />
              ) : (
                <div>
                  <QrCode className="mx-auto h-28 w-28 text-primary" />
                  <p className="mt-3 font-bold">QRIS Statis belum diupload</p>
                  <p className="text-sm text-[#3d4a42]">Owner dapat upload di Admin Management → Edit Admin.</p>
                </div>
              )}
            </div>
            <div>
              <p className="font-bold">QRIS Statis {shopName}</p>
              <p className="text-sm text-[#3d4a42]">Total {formatCurrency(total)}</p>
            </div>
            <p className="text-sm text-[#3d4a42]">Admin konfirmasi setelah pembeli menunjukkan pembayaran berhasil.</p>
            <Button className="w-full" size="lg" disabled={submitting} onClick={() => completeCheckout("qris_static")}>{submitting ? "Menyimpan..." : "Pembayaran Diterima"}</Button>
          </div>
        ) : null}

        {paymentMethod === "qris_pakasir" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex min-h-72 w-72 items-center justify-center rounded-3xl border border-[#bccac0] bg-white p-4 shadow-sm">
              {paymentStatus === "paid" ? (
                <CheckCircle2 className="h-28 w-28 text-emerald-500" />
              ) : submitting ? (
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              ) : pakasirPayment?.qrImageDataUrl ? (
                <img src={pakasirPayment.qrImageDataUrl} alt={`QRIS Pakasir ${pakasirPayment.orderId}`} className="h-full w-full rounded-2xl object-contain" />
              ) : (
                <div className="flex h-60 w-60 flex-col items-center justify-center rounded-2xl bg-[#eff4ff] p-6 text-[#3d4a42]">
                  <QrCode className="mb-3 h-16 w-16" />
                  <p className="text-sm font-semibold">Membuat QRIS dari Pakasir...</p>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-bold">Order ID {pakasirPayment?.orderId ?? "Membuat order..."}</p>
              <p className="text-sm text-[#3d4a42]">Nominal barang {formatCurrency(total)}</p>
              {pakasirPayment?.fee ? <p className="text-xs text-[#3d4a42]">Fee Pakasir {formatCurrency(pakasirPayment.fee)} • Total bayar {formatCurrency(pakasirPayment.totalPayment ?? total)}</p> : null}
              {pakasirPayment?.expiredAt ? <p className="text-xs text-[#3d4a42]">Expired: {new Date(pakasirPayment.expiredAt).toLocaleString("id-ID")}</p> : null}
              <Badge variant={paymentStatus === "paid" ? "success" : paymentStatus === "failed" ? "danger" : "warning"} className="mt-3 normal-case tracking-normal">
                {paymentStatus === "paid" ? "Paid / Success" : paymentStatus === "failed" ? "Gagal" : "Menunggu pembayaran dari Pakasir"}
              </Badge>
            </div>
            {pakasirPayment?.paymentUrl ? (
              <a href={pakasirPayment.paymentUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary hover:bg-[#eff4ff]">
                Buka halaman bayar Pakasir
              </a>
            ) : null}
            <Button variant="outline" onClick={() => setPaymentMethod(null)} disabled={submitting}>Batal</Button>
          </div>
        ) : null}

        {paymentMethod === "debt" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#213145] p-4 text-white"><div className="flex items-center justify-between"><div><p className="text-sm text-white/70">Nominal Hutang</p><p className="text-4xl font-extrabold">{formatCurrency(total)}</p></div><NotebookPen className="h-10 w-10 text-emerald-200" /></div></div>
            <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Nama pelanggan</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Contoh Pak Rudi" /></div><div className="space-y-2"><Label>No. HP</Label><Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="08xxxxxxxxxx" /></div></div>
            <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Jatuh tempo</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div className="space-y-2"><Label>Status awal</Label><Select defaultValue="Belum Lunas" disabled><option>Belum Lunas</option></Select></div></div>
            <div className="space-y-2"><Label>Catatan</Label><Textarea value={debtNote} onChange={(event) => setDebtNote(event.target.value)} placeholder="Alamat, alasan, atau catatan pelanggan..." /></div>
            <div className="rounded-2xl border border-[#bccac0] bg-[#eff4ff] p-4 text-sm text-[#3d4a42]"><div className="flex items-center gap-2 font-bold text-[#0b1c30]"><Clock className="h-4 w-4" /> Masuk ke Buku Hutang</div><p className="mt-2">Transaksi akan tercatat sebagai metode <b>Hutang</b> dan muncul di halaman Catatan Hutang.</p></div>
            <Button className="w-full" size="lg" disabled={!customerName || !dueDate || submitting} onClick={() => completeCheckout("debt")}>{submitting ? "Menyimpan..." : "Simpan Catatan Hutang"}</Button>
          </div>
        ) : null}
      </Modal>

      {successOpen && successSummary ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b1c30]/45 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(11,28,48,0.28)]">
            <div className="absolute left-8 top-8 h-5 w-5 animate-ping rounded-full bg-emerald-300/80" />
            <div className="absolute right-10 top-12 h-3 w-3 animate-ping rounded-full bg-[#dae2fd]" />
            <div className="absolute bottom-10 left-12 h-4 w-4 animate-ping rounded-full bg-primary/30" />

            <div className="mx-auto mb-5 flex h-24 w-24 animate-bounce items-center justify-center rounded-full bg-emerald-100 text-primary ring-8 ring-emerald-50">
              <CheckCircle2 className="h-14 w-14" />
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#3d4a42]">Pembayaran selesai</p>
            <h3 className="mt-2 text-3xl font-extrabold text-[#0b1c30]">Transaksi Berhasil</h3>
            <p className="mt-3 text-sm text-[#3d4a42]">
              {methodLabel[successSummary.method]} • {successSummary.totalItems} item
            </p>
            <p className="mt-4 text-4xl font-black text-primary">{formatCurrency(successSummary.total)}</p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#eff4ff]">
              <div className="h-full w-full animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
