"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Minus, NotebookPen, PackagePlus, Plus, QrCode, Search, ShoppingCart, Trash2, WalletCards } from "lucide-react";
import { api, ApiError, type CheckoutItem, type CheckoutResponse, type PaymentMethod, type ProductRecord, type SessionUser } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type CartItem = ProductRecord & { qty: number; isManual?: boolean };
type PaymentStatus = "idle" | "waiting" | "paid" | "failed";

type ManualItem = {
  name: string;
  sku: string;
  price: string;
  costPrice: string;
  quantity: string;
  stock: string;
  saveToInventory: boolean;
};

const emptyManualItem: ManualItem = {
  name: "",
  sku: "",
  price: "",
  costPrice: "0",
  quantity: "1",
  stock: "",
  saveToInventory: false,
};

const methodLabel: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris_static: "QRIS Statis",
  qris_pakasir: "QRIS Pakasir",
  debt: "Catat Hutang",
};

function makeManualId() {
  return `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function HomePosClient() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [shopName, setShopName] = useState("KasirKita");
  const [shopQrisImage, setShopQrisImage] = useState("");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualItem, setManualItem] = useState<ManualItem>(emptyManualItem);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [pakasirPayment, setPakasirPayment] = useState<CheckoutResponse["payment"] | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [debtNote, setDebtNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const me = await api.me();
      setUser(me.user);
      if (me.shop?.name) setShopName(me.shop.name);
      setShopQrisImage(me.shop?.qrisStaticImageUrl ?? "");
      if (me.user.role !== "admin") {
        setProducts([]);
        setError("Checkout di halaman utama hanya untuk akun admin kasir. Login sebagai admin untuk transaksi.");
        return;
      }
      const rows = await api.products.list();
      setProducts(rows.filter((product) => product.isActive !== false));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Login sebagai admin untuk memakai quick POS di halaman utama.");
      } else {
        setError(err instanceof Error ? err.message : "Gagal memuat data kasir");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (paymentMethod !== "qris_pakasir" || !pakasirPayment?.reference || paymentStatus !== "waiting") return;

    const timer = window.setInterval(async () => {
      try {
        const result = await api.pollPakasir(pakasirPayment.reference);
        if (result.status === "paid") {
          setPaymentStatus("paid");
          window.setTimeout(resetTransaction, 1200);
        } else if (result.status === "failed" || result.status === "cancelled") {
          setPaymentStatus("failed");
          setError("Pembayaran Pakasir gagal atau dibatalkan.");
        }
      } catch (err) {
        setPaymentStatus("failed");
        setError(err instanceof Error ? err.message : "Gagal cek status QRIS Pakasir");
      }
    }, pakasirPayment.pollEveryMs || 3000);

    return () => window.clearInterval(timer);
  }, [paymentMethod, pakasirPayment, paymentStatus]);

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products.slice(0, 4);
    return products.filter((product) => product.name.toLowerCase().includes(keyword) || product.sku.toLowerCase().includes(keyword)).slice(0, 6);
  }, [products, query]);

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const change = Math.max(cashReceived - total, 0);

  function addToCart(product: ProductRecord, quantity = 1) {
    const safeQty = Math.max(1, Math.floor(quantity));
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) {
        return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + safeQty } : item);
      }
      return [...current, { ...product, qty: safeQty }];
    });
  }

  function updateQty(id: string, qty: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item];
      if (!Number.isFinite(qty) || qty <= 0) return [];
      return [{ ...item, qty: Math.floor(qty) }];
    }));
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
    setDebtNote("");
    setSubmitting(false);
  }

  async function addManualItem() {
    if (!isAdmin) {
      setError("Login sebagai admin untuk menambahkan item.");
      return;
    }

    const name = manualItem.name.trim();
    const price = Number(manualItem.price);
    const quantity = Math.max(1, Number(manualItem.quantity));
    const costPrice = Math.max(0, Number(manualItem.costPrice) || 0);
    const sku = manualItem.sku.trim() || `ITEM-${Date.now().toString().slice(-6)}`;

    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity)) {
      setError("Isi nama barang, harga, dan quantity dengan benar.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (manualItem.saveToInventory) {
        const product = await api.products.create({
          name,
          sku,
          price: Math.round(price),
          costPrice: Math.round(costPrice),
          stock: manualItem.stock ? Number(manualItem.stock) : null,
        });
        setProducts((current) => [product, ...current]);
        addToCart(product, quantity);
      } else {
        setCart((current) => [
          ...current,
          {
            id: makeManualId(),
            sku,
            name,
            price: Math.round(price),
            costPrice: Math.round(costPrice),
            stock: null,
            photoUrl: null,
            isActive: true,
            isManual: true,
            qty: Math.floor(quantity),
          },
        ]);
      }
      setManualItem(emptyManualItem);
      setManualOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan barang");
    } finally {
      setSubmitting(false);
    }
  }

  async function openPayment(method: PaymentMethod) {
    if (!isAdmin) {
      setError("Login sebagai admin untuk memproses pembayaran.");
      return;
    }
    if (cart.length === 0) {
      setError("Tambahkan barang ke keranjang dulu.");
      return;
    }

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
        setError(err instanceof Error ? err.message : "Gagal membuat pembayaran QRIS Pakasir");
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
        note: method === "debt" ? debtNote : undefined,
        items: itemsPayload(),
      });
      setPaymentStatus("paid");
      window.setTimeout(resetTransaction, 900);
    } catch (err) {
      setPaymentStatus("failed");
      setError(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-[#bccac0] bg-white shadow-[0_20px_60px_rgba(33,49,69,0.10)]">
      <div className="absolute inset-x-0 top-0 h-2 bg-primary" />
      <div className="p-5 sm:p-6">
        <div className="rounded-3xl bg-[#213145] p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/60">Total Belanja</p>
              <p className="mt-2 text-4xl font-extrabold">{formatCurrency(total)}</p>
              <p className="mt-1 text-xs text-white/60">{totalQty} item dalam keranjang</p>
            </div>
            <QrCode className="h-12 w-12 shrink-0 text-emerald-200" />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#3d4a42]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Cari nama barang atau SKU..." />
          </div>
          <Button variant="outline" onClick={() => setManualOpen(true)} disabled={!isAdmin} className="shrink-0">
            <PackagePlus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>

        {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => openPayment("cash")} disabled={!isAdmin || cart.length === 0}>Tunai</Button>
          <Button variant="outline" onClick={() => openPayment("qris_pakasir")} disabled={!isAdmin || cart.length === 0}>QRIS Pakasir</Button>
          <Button variant="outline" onClick={() => openPayment("qris_static")} disabled={!isAdmin || cart.length === 0}>QRIS Statis</Button>
          <Button variant="navy" onClick={() => openPayment("debt")} disabled={!isAdmin || cart.length === 0}>Catat Hutang</Button>
        </div>

        <div className="mt-5 space-y-3">
          {cart.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#bccac0] bg-[#f8f9ff] p-4 text-center text-sm text-[#3d4a42]">
              {loading ? "Memuat produk..." : "Cari produk, klik barang, atau Add Item untuk mulai transaksi."}
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#bccac0] bg-[#f8f9ff] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-[#3d4a42]">{formatCurrency(item.price)} × {item.qty}</p>
                  </div>
                  <button onClick={() => updateQty(item.id, 0)} className="text-[#3d4a42] hover:text-red-600" aria-label={`Hapus ${item.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="grid w-32 grid-cols-3 overflow-hidden rounded-xl border border-[#bccac0] bg-white">
                    <button onClick={() => updateQty(item.id, item.qty - 1)} className="flex h-9 items-center justify-center"><Minus className="h-4 w-4" /></button>
                    <input value={item.qty} onChange={(event) => updateQty(item.id, Number(event.target.value))} className="h-9 w-full border-x border-[#bccac0] bg-white text-center text-sm font-bold outline-none" aria-label={`Quantity ${item.name}`} />
                    <button onClick={() => updateQty(item.id, item.qty + 1)} className="flex h-9 items-center justify-center"><Plus className="h-4 w-4" /></button>
                  </div>
                  <p className="text-right text-base font-extrabold text-primary">{formatCurrency(item.price * item.qty)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-[#bccac0] bg-white p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-bold">
            <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Produk Database</span>
            <button onClick={loadData} className="text-xs text-primary">Refresh</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredProducts.map((product) => {
              const qty = cart.find((item) => item.id === product.id)?.qty ?? 0;
              return (
                <button key={product.id} onClick={() => addToCart(product)} disabled={!isAdmin} className="rounded-xl border border-[#bccac0] bg-[#f8f9ff] p-3 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-bold">{product.name}</p>
                    {qty > 0 ? <Badge variant="success" className="normal-case tracking-normal">×{qty}</Badge> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#3d4a42]">
                    <span>SKU {product.sku}</span>
                    <b className="text-primary">{formatCurrency(product.price)}</b>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={manualOpen} title="Add Item / Tambah Barang" description="Bisa langsung masuk keranjang, atau disimpan juga ke inventaris backend." onClose={() => !submitting ? setManualOpen(false) : undefined}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nama barang</Label>
              <Input value={manualItem.name} onChange={(event) => setManualItem((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Kopi Sachet" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>SKU opsional</Label>
              <Input value={manualItem.sku} onChange={(event) => setManualItem((current) => ({ ...current, sku: event.target.value }))} placeholder="Auto jika kosong" />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={manualItem.quantity} onChange={(event) => setManualItem((current) => ({ ...current, quantity: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Harga jual</Label>
              <Input type="number" min={0} value={manualItem.price} onChange={(event) => setManualItem((current) => ({ ...current, price: event.target.value }))} placeholder="Contoh 12000" />
            </div>
            <div className="space-y-2">
              <Label>Harga modal</Label>
              <Input type="number" min={0} value={manualItem.costPrice} onChange={(event) => setManualItem((current) => ({ ...current, costPrice: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Stok awal jika disimpan ke inventaris</Label>
              <Input type="number" min={0} value={manualItem.stock} onChange={(event) => setManualItem((current) => ({ ...current, stock: event.target.value }))} placeholder="Opsional" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#bccac0] bg-[#eff4ff] p-3 text-sm font-semibold">
            <input type="checkbox" checked={manualItem.saveToInventory} onChange={(event) => setManualItem((current) => ({ ...current, saveToInventory: event.target.checked }))} className="h-4 w-4 accent-primary" />
            Simpan juga ke inventaris database
          </label>
          <div className="rounded-2xl bg-[#213145] p-4 text-white">
            <p className="text-sm text-white/70">Subtotal</p>
            <p className="text-3xl font-extrabold">{formatCurrency((Number(manualItem.price) || 0) * (Number(manualItem.quantity) || 0))}</p>
          </div>
          <Button className="w-full" size="lg" onClick={addManualItem} disabled={submitting || !isAdmin}>
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackagePlus className="mr-2 h-5 w-5" />}
            Tambahkan Barang
          </Button>
        </div>
      </Modal>

      <Modal open={paymentMethod !== null} title={paymentMethod ? `Pembayaran ${methodLabel[paymentMethod]}` : "Pembayaran"} description="Pembayaran dari halaman utama dikirim ke API checkout backend." onClose={() => !submitting ? setPaymentMethod(null) : undefined}>
        {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

        {paymentMethod === "cash" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#eff4ff] p-4"><p className="text-sm text-[#3d4a42]">Total transaksi</p><p className="text-4xl font-extrabold text-primary">{formatCurrency(total)}</p></div>
            <div className="space-y-2"><Label>Uang diterima</Label><Input type="number" value={cashReceived || ""} onChange={(event) => setCashReceived(Number(event.target.value))} placeholder="Contoh 100000" /></div>
            <div className="rounded-2xl border border-[#bccac0] p-4"><p className="text-sm text-[#3d4a42]">Kembalian</p><p className="text-3xl font-extrabold text-primary">{formatCurrency(change)}</p></div>
            <Button className="w-full" size="lg" disabled={cashReceived < total || submitting} onClick={() => completeCheckout("cash")}>{submitting ? "Menyimpan..." : "Selesaikan Transaksi"}</Button>
          </div>
        ) : null}

        {paymentMethod === "qris_static" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-64 w-64 items-center justify-center overflow-hidden rounded-3xl border bg-white">
              {shopQrisImage ? (
                <img src={shopQrisImage} alt={`QRIS Statis ${shopName}`} className="h-full w-full object-contain p-4" />
              ) : (
                <div>
                  <QrCode className="mx-auto h-24 w-24 text-primary" />
                  <p className="mt-3 font-bold">QRIS Statis belum diupload</p>
                  <p className="text-sm text-[#3d4a42]">Upload dari Owner → Admin Management → Edit Admin.</p>
                </div>
              )}
            </div>
            <p className="font-bold">QRIS Statis {shopName}</p>
            <p className="text-sm text-[#3d4a42]">Total {formatCurrency(total)}</p>
            <Button className="w-full" size="lg" disabled={submitting} onClick={() => completeCheckout("qris_static")}>{submitting ? "Menyimpan..." : "Pembayaran Diterima"}</Button>
          </div>
        ) : null}

        {paymentMethod === "qris_pakasir" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex min-h-64 w-64 items-center justify-center rounded-3xl border border-[#bccac0] bg-white p-4 shadow-sm">
              {paymentStatus === "paid" ? (
                <CheckCircle2 className="h-24 w-24 text-emerald-500" />
              ) : submitting ? (
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              ) : pakasirPayment?.qrImageDataUrl ? (
                <img src={pakasirPayment.qrImageDataUrl} alt={`QRIS Pakasir ${pakasirPayment.orderId}`} className="h-full w-full rounded-2xl object-contain" />
              ) : (
                <div className="flex h-52 w-52 flex-col items-center justify-center rounded-2xl bg-[#eff4ff] p-6 text-[#3d4a42]">
                  <QrCode className="mb-3 h-14 w-14" />
                  <p className="text-sm font-semibold">Membuat QRIS...</p>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-bold">Order ID {pakasirPayment?.orderId ?? "Membuat order..."}</p>
              <p className="text-sm text-[#3d4a42]">Nominal barang {formatCurrency(total)}</p>
              {pakasirPayment?.fee ? <p className="text-xs text-[#3d4a42]">Fee {formatCurrency(pakasirPayment.fee)} • Total bayar {formatCurrency(pakasirPayment.totalPayment ?? total)}</p> : null}
              <Badge variant={paymentStatus === "paid" ? "success" : paymentStatus === "failed" ? "danger" : "warning"} className="mt-3 normal-case tracking-normal">
                {paymentStatus === "paid" ? "Paid / Success" : paymentStatus === "failed" ? "Gagal" : "Menunggu pembayaran Pakasir"}
              </Badge>
            </div>
            {pakasirPayment?.paymentUrl ? (
              <a href={pakasirPayment.paymentUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary hover:bg-[#eff4ff]">
                Buka halaman bayar Pakasir
              </a>
            ) : null}
          </div>
        ) : null}

        {paymentMethod === "debt" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#213145] p-4 text-white"><p className="text-sm text-white/70">Nominal Hutang</p><p className="text-4xl font-extrabold">{formatCurrency(total)}</p></div>
            <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Nama pelanggan</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Contoh Pak Rudi" /></div><div className="space-y-2"><Label>No. HP</Label><Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="08xxxxxxxxxx" /></div></div>
            <div className="space-y-2"><Label>Catatan hutang</Label><Textarea value={debtNote} onChange={(event) => setDebtNote(event.target.value)} placeholder="Alamat, catatan pelanggan, dll" /></div>
            <Button className="w-full" size="lg" disabled={!customerName || submitting} onClick={() => completeCheckout("debt")}>{submitting ? "Menyimpan..." : "Simpan Hutang"}</Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
