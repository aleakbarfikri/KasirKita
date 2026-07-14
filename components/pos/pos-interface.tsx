"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Barcode, Camera, CheckCircle2, ChevronDown, ChevronUp, Clock, CloudOff, Copy, CreditCard, Loader2, Minus, MoreVertical, NotebookPen, PackagePlus, Plus, Printer, QrCode, RefreshCw, ScanLine, Search, Send, ShoppingCart, Trash2, WalletCards } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { ApiError, api, type CheckoutItem, type CheckoutPayload, type CheckoutResponse, type PaymentMethod, type ProductRecord, type ReceiptRecord } from "@/lib/api-client";
import { cacheProducts, enqueueOfflineCheckout, readCachedProducts, readOfflineCheckouts, replaceOfflineCheckouts, type OfflineCheckout } from "@/lib/offline-pos";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppLanguage } from "@/lib/i18n";
import { UpgradeSubscriptionCta } from "@/components/subscription/upgrade-cta";

type CartItem = ProductRecord & { qty: number; isManual?: boolean };
type ModalMethod = PaymentMethod | null;

type PaymentStatus = "idle" | "waiting" | "paid" | "failed";
type SuccessSummary = { method: PaymentMethod; total: number; totalItems: number; queued?: boolean };
type DiscountType = "none" | "percent" | "amount";
type ReceiptPaperWidth = "58mm" | "80mm";
type BluetoothWriteCharacteristic = {
  properties?: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
};

const methodLabel: Record<PaymentMethod, string> = {
  cash: "Tunai (Cash)",
  qris_static: "QRIS Statis UMKM",
  qris_pakasir: "QRIS KasirKita Dinamis",
  debt: "Catat Hutang Pelanggan",
};

function shortInvoiceId(id?: string | null) {
  if (!id) return "-";
  const cleanId = id.replace(/^trx_/i, "");
  const shortId = cleanId.slice(0, 8).toUpperCase();
  return shortId ? `TRX-${shortId}` : "-";
}

const emptyManualItem = {
  name: "",
  sku: "",
  price: "",
  quantity: "1",
};

const thermalBluetoothServices = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

function sanitizeReceiptText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n\r]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapThermalText(text: string, width: number) {
  const words = sanitizeReceiptText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word.slice(0, width);
      if (word.length > width) lines.push(current);
      if (word.length > width) current = word.slice(width);
      continue;
    }
    if (`${current} ${word}`.length <= width) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word.slice(0, width);
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function thermalColumns(left: string, right: string, width: number) {
  const cleanLeft = sanitizeReceiptText(left);
  const cleanRight = sanitizeReceiptText(right);
  const rightWidth = Math.min(cleanRight.length, Math.max(10, Math.floor(width * 0.42)));
  const leftWidth = Math.max(8, width - rightWidth - 1);
  const leftLines = wrapThermalText(cleanLeft, leftWidth);
  const rightText = cleanRight.slice(-rightWidth);
  return leftLines.map((line, index) => {
    if (index < leftLines.length - 1) return line;
    const spaces = " ".repeat(Math.max(1, width - line.length - rightText.length));
    return `${line}${spaces}${rightText}`;
  }).join("\n");
}

function buildEscPosReceipt(receipt: ReceiptRecord, paperWidth: ReceiptPaperWidth) {
  const trx = receipt.transaction;
  const width = paperWidth === "80mm" ? 48 : 32;
  const line = "-".repeat(width);
  const center = (text: string) => {
    const clean = sanitizeReceiptText(text);
    if (clean.length >= width) return wrapThermalText(clean, width).join("\n");
    return `${" ".repeat(Math.floor((width - clean.length) / 2))}${clean}`;
  };
  const body = [
    receipt.showWatermark ? center(receipt.watermarkText || "www.kasir-kita.com") : "",
    center(receipt.shop.name),
    receipt.shop.address ? center(receipt.shop.address) : "",
    receipt.shop.phone ? center(`Telp: ${receipt.shop.phone}`) : "",
    line,
    thermalColumns("Invoice", trx.invoiceNumber, width),
    thermalColumns("Tanggal", new Date(trx.createdAt).toLocaleString("id-ID"), width),
    thermalColumns("Kasir", receipt.cashier.name, width),
    thermalColumns("Metode", methodLabel[trx.paymentMethod], width),
    line,
    ...receipt.items.flatMap((item) => [
      ...wrapThermalText(item.name, width),
      thermalColumns(`${item.quantity} x ${formatCurrency(item.price)}`, formatCurrency(item.price * item.quantity), width),
      item.discountAmount ? `Diskon item: ${formatCurrency(item.discountAmount)} / pcs` : "",
    ]),
    line,
    receipt.transaction.subtotal !== undefined ? thermalColumns("Subtotal", formatCurrency(receipt.transaction.subtotal), width) : "",
    receipt.transaction.discountAmount ? thermalColumns("Diskon", `-${formatCurrency(receipt.transaction.discountAmount)}`, width) : "",
    thermalColumns("TOTAL", formatCurrency(trx.total), width),
    trx.paidAmount !== null && trx.paidAmount !== undefined ? thermalColumns("Dibayar", formatCurrency(trx.paidAmount), width) : "",
    trx.changeAmount !== null && trx.changeAmount !== undefined ? thermalColumns("Kembalian", formatCurrency(trx.changeAmount), width) : "",
    receipt.publicUrl ? line : "",
    receipt.publicUrl ? center("Struk digital") : "",
    receipt.publicUrl ? wrapThermalText(receipt.publicUrl, width).join("\n") : "",
    line,
    center("Terima kasih"),
    "",
    "",
    "",
  ].filter(Boolean).join("\n");

  const encoder = new TextEncoder();
  const init = new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x00]);
  const content = encoder.encode(`${body}\n`);
  const cut = new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
  const payload = new Uint8Array(init.length + content.length + cut.length);
  payload.set(init, 0);
  payload.set(content, init.length);
  payload.set(cut, init.length + content.length);
  return payload;
}

export function PosInterface() {
  const { language, t } = useAppLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [shopName, setShopName] = useState("UMKM Berkah");
  const [shopQrisImage, setShopQrisImage] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartSearch, setCartSearch] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartMenuOpen, setCartMenuOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [receiptMenuOpen, setReceiptMenuOpen] = useState(false);
  const [checkoutDiscountType, setCheckoutDiscountType] = useState<DiscountType>("none");
  const [checkoutDiscountValue, setCheckoutDiscountValue] = useState("");
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<ReceiptPaperWidth>("58mm");
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
  const [skuScannerOpen, setSkuScannerOpen] = useState(false);
  const [scannerRunId, setScannerRunId] = useState(0);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("Arahkan kamera ke barcode SKU produk.");
  const [lastScannedSku, setLastScannedSku] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [directPrinting, setDirectPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineCheckout[]>([]);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptRecord | null>(null);

  const categories = useMemo(() => ["Semua", "Stok Rendah", "Terbaru"], []);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const [rows, me] = await Promise.all([api.products.list(), api.me().catch(() => null)]);
      const activeProducts = rows.filter((product) => product.isActive !== false);
      setProducts(activeProducts);
      cacheProducts(activeProducts);
      if (me?.shop?.name) setShopName(me.shop.name);
      setShopQrisImage(me?.shop?.qrisStaticImageUrl ?? "");
    } catch (err) {
      const cached = readCachedProducts();
      if (cached?.products.length) {
        setProducts(cached.products.filter((product) => product.isActive !== false));
        setError(`Produk offline dipakai dari cache terakhir (${new Date(cached.cachedAt).toLocaleString("id-ID")}).`);
      } else {
        setError(err instanceof Error ? err.message : "Gagal memuat produk");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setOfflineQueue(readOfflineCheckouts());
    loadProducts();
  }, []);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine);
      setOfflineQueue(readOfflineCheckouts());
    }

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (syncingOffline || typeof navigator !== "undefined" && !navigator.onLine) return;

    const queued = readOfflineCheckouts();
    if (queued.length === 0) {
      setOfflineQueue([]);
      return;
    }

    setSyncingOffline(true);
    const remaining: OfflineCheckout[] = [];
    let syncedCount = 0;

    for (const item of queued) {
      try {
        await api.checkout(item.payload);
        syncedCount += 1;
      } catch (err) {
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          lastError: err instanceof Error ? err.message : "Gagal sync transaksi offline",
        });
      }
    }

    replaceOfflineCheckouts(remaining);
    setOfflineQueue(remaining);
    if (syncedCount > 0) await loadProducts();
    setSyncingOffline(false);
  }, [syncingOffline]);

  useEffect(() => {
    if (!isOnline || offlineQueue.length === 0) return;
    syncOfflineQueue();
  }, [isOnline, offlineQueue.length, syncOfflineQueue]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (navigator.onLine && readOfflineCheckouts().length > 0) syncOfflineQueue();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [syncOfflineQueue]);

  useEffect(() => {
    if (paymentMethod !== "qris_pakasir" || !pakasirPayment?.reference || paymentStatus !== "waiting") return;

    const timer = window.setInterval(async () => {
      try {
        const result = await api.pollPakasir(pakasirPayment.reference);
        if (result.status === "paid") {
          setPaymentStatus("paid");
          await loadProducts();
          showCheckoutSuccess("qris_pakasir");
        } else if (result.status === "failed" || result.status === "cancelled") {
          setPaymentStatus("failed");
          setError("Pembayaran QRIS KasirKita gagal atau dibatalkan.");
        }
      } catch (err) {
        setPaymentStatus("failed");
        setError(err instanceof Error ? err.message : "Gagal mengecek status QRIS KasirKita");
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
  function productDiscountAmount(product: ProductRecord) {
    const type = product.discountType ?? "none";
    const value = Math.max(0, Math.round(product.discountValue ?? 0));
    const price = Math.max(0, Math.round(product.price ?? 0));
    if (type === "percent") return Math.min(price, Math.round(price * Math.min(value, 100) / 100));
    if (type === "amount") return Math.min(price, value);
    return 0;
  }

  function productFinalPrice(product: ProductRecord) {
    return Math.max(0, Math.round((product.price ?? 0) - productDiscountAmount(product)));
  }

  function discountLabel(product: ProductRecord) {
    const type = product.discountType ?? "none";
    const value = product.discountValue ?? 0;
    if (type === "percent" && value > 0) return `${value}%`;
    if (type === "amount" && value > 0) return formatCurrency(value);
    return "";
  }

  function calculateCheckoutDiscount(base: number) {
    const value = Math.max(0, Math.round(Number(checkoutDiscountValue) || 0));
    if (checkoutDiscountType === "percent") return Math.min(base, Math.round(base * Math.min(value, 100) / 100));
    if (checkoutDiscountType === "amount") return Math.min(base, value);
    return 0;
  }

  const subtotal = cart.reduce((sum, item) => sum + productFinalPrice(item) * item.qty, 0);
  const checkoutDiscountAmount = calculateCheckoutDiscount(subtotal);
  const total = Math.max(0, subtotal - checkoutDiscountAmount);
  const change = Math.max(cashReceived - total, 0);
  const filteredCart = useMemo(() => {
    const keyword = cartSearch.trim().toLowerCase();
    if (!keyword) return cart;
    return cart.filter((item) => item.name.toLowerCase().includes(keyword) || item.sku.toLowerCase().includes(keyword));
  }, [cart, cartSearch]);

  const addToCart = useCallback((product: ProductRecord, quantity = 1) => {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + safeQuantity } : item);
      return [...current, { ...product, qty: safeQuantity }];
    });
  }, []);

  const stopSkuScanner = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
  }, []);

  function openSkuScanner() {
    scanHandledRef.current = false;
    setLastScannedSku("");
    setScannerMessage("Meminta izin kamera...");
    setScannerRunId((current) => current + 1);
    setSkuScannerOpen(true);
  }

  const handleScannedSku = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setLastScannedSku(code);
    setQuery(code);

    const exact = products.find((product) => product.sku.toLowerCase() === code.toLowerCase());
    if (exact) {
      addToCart(exact);
      setQuery("");
      setError(null);
      setScannerMessage(language === "en" ? `SKU ${code} added to cart.` : `SKU ${code} masuk ke keranjang.`);
      setSkuScannerOpen(false);
      return;
    }

    setScannerMessage(language === "en" ? `SKU ${code} was not found. Manual item is opened.` : `SKU ${code} tidak ditemukan. Item manual dibuka.`);
    setManualItem((current) => ({ ...current, name: code, sku: code.toUpperCase() }));
    setSkuScannerOpen(false);
    setManualItemOpen(true);
  }, [addToCart, products]);

  useEffect(() => {
    if (!skuScannerOpen) {
      stopSkuScanner();
      return;
    }

    let alive = true;

    async function startScanner() {
      if (!videoRef.current) return;

      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerMessage("Kamera tidak tersedia di browser ini.");
        return;
      }

      if (!window.isSecureContext) {
        setScannerMessage("Kamera perlu HTTPS. Gunakan Vercel/HTTPS atau localhost saat testing.");
        return;
      }

      setScannerStarting(true);
      setScannerMessage("Meminta izin kamera...");

      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 180,
          delayBetweenScanSuccess: 500,
        });

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result) => {
            if (!result || scanHandledRef.current) return;
            scanHandledRef.current = true;
            stopSkuScanner();
            handleScannedSku(result.getText());
          },
        );

        if (!alive) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
        setScannerMessage("Arahkan kamera ke barcode SKU produk.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gagal membuka kamera.";
        setScannerMessage(
          message.includes("Permission") || message.includes("NotAllowed")
            ? (language === "en" ? "Camera permission was denied. Enable camera access in the browser." : "Izin kamera ditolak. Aktifkan izin kamera di browser.")
            : (language === "en" ? `Failed to open camera: ${message}` : `Gagal membuka kamera: ${message}`),
        );
      } finally {
        if (alive) setScannerStarting(false);
      }
    }

    startScanner();

    return () => {
      alive = false;
      stopSkuScanner();
    };
  }, [handleScannedSku, scannerRunId, skuScannerOpen, stopSkuScanner]);

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
      originalPrice: item.price,
      price: productFinalPrice(item),
      discountAmount: productDiscountAmount(item),
      quantity: item.qty,
    }));
  }

  function resetTransaction() {
    setCart([]);
    setPaymentMethod(null);
    setCashReceived(0);
    setCheckoutDiscountType("none");
    setCheckoutDiscountValue("");
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

  function showCheckoutSuccess(method: PaymentMethod, options: { queued?: boolean; receipt?: ReceiptRecord | null } = {}) {
    if (options.receipt) setLastReceipt(options.receipt);
    setSuccessSummary({ method, total, totalItems, queued: options.queued });
    setSuccessOpen(true);
    setPaymentMethod(null);
    setSubmitting(false);
    if (!options.receipt && !lastReceipt) {
      window.setTimeout(() => {
        resetTransaction();
        setSuccessOpen(false);
      }, 1900);
    }
  }

  function startNewTransaction() {
    resetTransaction();
    setLastReceipt(null);
    setSuccessOpen(false);
  }

  function receiptText(receipt: ReceiptRecord) {
    const trx = receipt.transaction;
    const lines = [
      receipt.shop.name,
      receipt.showWatermark ? receipt.watermarkText || "www.kasir-kita.com" : "",
      receipt.shop.address || "",
      receipt.shop.phone ? `Telp: ${receipt.shop.phone}` : "",
      "",
      `Invoice: ${trx.invoiceNumber}`,
      `Tanggal: ${new Date(trx.createdAt).toLocaleString("id-ID")}`,
      `Kasir: ${receipt.cashier.name}`,
      `Metode: ${methodLabel[trx.paymentMethod]}`,
      "",
      ...receipt.items.map((item) => `${item.name} x${item.quantity} = ${formatCurrency(item.price * item.quantity)}${item.discountAmount ? ` (diskon ${formatCurrency(item.discountAmount)}/item)` : ""}`),
      "",
      receipt.transaction.subtotal !== undefined ? `Subtotal: ${formatCurrency(receipt.transaction.subtotal)}` : "",
      receipt.transaction.discountAmount ? `Diskon transaksi: -${formatCurrency(receipt.transaction.discountAmount)}` : "",
      `Total: ${formatCurrency(trx.total)}`,
      trx.paidAmount !== null && trx.paidAmount !== undefined ? `Dibayar: ${formatCurrency(trx.paidAmount)}` : "",
      trx.changeAmount !== null && trx.changeAmount !== undefined ? `Kembalian: ${formatCurrency(trx.changeAmount)}` : "",
      receipt.publicUrl ? `Struk digital: ${receipt.publicUrl}` : "",
      "",
      "Terima kasih.",
    ];
    return lines.filter(Boolean).join("\n");
  }

  async function printThermalReceipt(receipt: ReceiptRecord) {
    const trx = receipt.transaction;
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
    const paperWidth = receiptPaperWidth;
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
      <html><head><title>Struk ${escapeHtml(trx.invoiceNumber)}</title>
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
        .right { text-align: right; font-weight: 700; }
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
          <div class="row"><span>Metode</span><span>${escapeHtml(methodLabel[trx.paymentMethod])}</span></div>
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
          <div class="center">Terima kasih</div>
        </div>
        <script>window.print();</script>
      </body></html>`;
    const win = window.open("", "_blank", "width=360,height=720");
    if (!win) {
      setError("Popup print diblokir browser. Izinkan popup untuk mencetak struk.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  async function findBluetoothWriteCharacteristic(server: { getPrimaryServices: () => Promise<Array<{ getCharacteristics: () => Promise<BluetoothWriteCharacteristic[]> }>> }) {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((item) => item.properties?.writeWithoutResponse || item.properties?.write);
      if (writable) return writable;
    }
    return null;
  }

  async function writeEscPosChunks(characteristic: BluetoothWriteCharacteristic, payload: Uint8Array) {
    const chunkSize = 20;
    for (let index = 0; index < payload.length; index += chunkSize) {
      const chunk = payload.slice(index, index + chunkSize);
      if (characteristic.properties?.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 12));
    }
  }

  async function directPrintThermalReceipt(receipt: ReceiptRecord) {
    const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice: (options: unknown) => Promise<{ gatt?: { connect: () => Promise<{ getPrimaryServices: () => Promise<Array<{ getCharacteristics: () => Promise<BluetoothWriteCharacteristic[]> }>> }> } }> } }).bluetooth;
    if (!bluetooth) {
      setError("Direct printer butuh Chrome/Edge dengan Web Bluetooth. Di iPhone/Safari biasanya tidak tersedia.");
      return;
    }

    setDirectPrinting(true);
    setError(null);
    try {
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: thermalBluetoothServices,
      });
      const server = await device.gatt?.connect();
      if (!server) throw new Error("Printer Bluetooth tidak bisa dihubungkan.");
      const characteristic = await findBluetoothWriteCharacteristic(server);
      if (!characteristic) throw new Error("Printer tidak menyediakan channel tulis ESC/POS. Coba mode Print biasa atau printer thermal Bluetooth lain.");
      await writeEscPosChunks(characteristic, buildEscPosReceipt(receipt, receiptPaperWidth));
      setError("Struk berhasil dikirim ke printer thermal.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal direct print ke printer thermal.");
    } finally {
      setDirectPrinting(false);
    }
  }

  function shareWhatsAppReceipt(receipt: ReceiptRecord) {
    const url = `https://wa.me/?text=${encodeURIComponent(receiptText(receipt))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyReceiptLink(receipt: ReceiptRecord) {
    if (!receipt.publicUrl) return;
    await navigator.clipboard.writeText(receipt.publicUrl);
    setError("Link struk digital berhasil disalin.");
  }

  function shouldQueueOffline(err: unknown) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    if (err instanceof ApiError) return err.status === 408 || err.status >= 500;
    return true;
  }

  function queueOfflineTransaction(payload: CheckoutPayload) {
    const queued = enqueueOfflineCheckout(payload);
    const nextQueue = readOfflineCheckouts();
    setOfflineQueue(nextQueue);
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setPaymentStatus("paid");
    setError(`Transaksi tersimpan offline (${queued.id.slice(-6)}). Akan sync otomatis saat internet stabil.`);
    showCheckoutSuccess(payload.paymentMethod, { queued: true });
  }

  async function openPayment(method: PaymentMethod) {
    if (cart.length === 0) return;
    setError(null);
    setMobileCartOpen(false);
    setCartMenuOpen(false);

    if (method === "qris_pakasir" && typeof navigator !== "undefined" && !navigator.onLine) {
      setError("QRIS KasirKita perlu internet untuk membuat QR dinamis. Gunakan Tunai, QRIS Statis, atau Hutang saat offline.");
      return;
    }

    setPaymentMethod(method);
    setPaymentStatus(method === "qris_pakasir" ? "waiting" : "idle");
    setPakasirPayment(null);

    if (method === "qris_pakasir") {
      setSubmitting(true);
      try {
      const result = await api.checkout({ paymentMethod: "qris_pakasir", discountType: checkoutDiscountType, discountValue: Number(checkoutDiscountValue || 0), items: itemsPayload() });
        if (result.receipt) setLastReceipt(result.receipt);
        setPakasirPayment(result.payment ?? null);
      } catch (err) {
        setPaymentStatus("failed");
        setError(err instanceof Error ? err.message : "Gagal membuat transaksi QRIS KasirKita");
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function completeCheckout(method: Exclude<PaymentMethod, "qris_pakasir">) {
    setSubmitting(true);
    setError(null);
    const payload: CheckoutPayload = {
      idempotencyKey: crypto.randomUUID(),
      paymentMethod: method,
      paidAmount: method === "cash" ? cashReceived : undefined,
      discountType: checkoutDiscountType,
      discountValue: Number(checkoutDiscountValue || 0),
      customerName: method === "debt" ? customerName : undefined,
      customerPhone: method === "debt" ? customerPhone : undefined,
      debtDueDate: method === "debt" ? dueDate : undefined,
      note: method === "debt" ? debtNote : undefined,
      items: itemsPayload(),
    };

    try {
      const result = await api.checkout(payload);
      setPaymentStatus("paid");
      await loadProducts();
      showCheckoutSuccess(method, { receipt: result.receipt ?? null });
    } catch (err) {
      if (shouldQueueOffline(err)) {
        queueOfflineTransaction(payload);
        return;
      }

      setError(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
      setPaymentStatus("failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-[#f8fafc] lg:h-full lg:min-h-0 lg:flex-row">
      <section className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1 lg:border-r lg:border-[#d7e2dc]">
        <div className="flex items-center justify-between border-b border-[#d7e2dc] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:px-6 lg:py-4">
          <div>
            <h2 className="text-xl font-black text-[#0f172a]">{shopName}</h2>
            <p className="text-xs font-medium text-[#64748b]">{t("POS Kasir")} • {t("Produk dari database dan cache offline")}</p>
          </div>
          <div className="hidden items-center gap-3 text-sm font-semibold text-primary md:flex">
            {isOnline ? <WalletCards className="h-5 w-5" /> : <CloudOff className="h-5 w-5 text-amber-600" />}
            {isOnline ? "Online" : "Offline"}
            {offlineQueue.length > 0 ? (
              <button
                type="button"
                onClick={syncOfflineQueue}
                disabled={!isOnline || syncingOffline}
                className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 disabled:opacity-60"
              >
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncingOffline ? "animate-spin" : ""}`} />
                {offlineQueue.length} pending sync
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-visible p-4 pb-36 custom-scrollbar lg:overflow-auto lg:p-6">
          <div className="mb-4 flex flex-col gap-2 md:hidden">
            <div className={isOnline ? "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700" : "rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800"}>
              {isOnline ? "Online - transaksi dikirim langsung." : "Offline - transaksi tunai, QRIS statis, dan hutang disimpan dulu di perangkat ini."}
            </div>
            {offlineQueue.length > 0 ? (
              <Button variant="outline" onClick={syncOfflineQueue} disabled={!isOnline || syncingOffline}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncingOffline ? "animate-spin" : ""}`} />
                Sync {offlineQueue.length} Transaksi Pending
              </Button>
            ) : null}
          </div>
          {offlineQueue.length > 0 ? (
            <div className="mb-4 hidden items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 md:flex">
              <span>{offlineQueue.length} transaksi tersimpan offline di perangkat ini.</span>
              <Button variant="outline" size="sm" onClick={syncOfflineQueue} disabled={!isOnline || syncingOffline}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncingOffline ? "animate-spin" : ""}`} />
                Sync Sekarang
              </Button>
            </div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              <p>{error}</p>
              <UpgradeSubscriptionCta message={error} />
            </div>
          ) : null}
          <div className="mb-4 grid grid-cols-1 gap-3 lg:mb-6 xl:grid-cols-[minmax(220px,1fr)_auto_auto_auto] xl:items-center">
            <div className="relative min-w-0">
              <Barcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748b]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" ? handleSkuSubmit() : undefined}
                className="h-12 min-w-0 rounded-lg border-[#cbd5e1] bg-white pl-12 pr-4 text-base shadow-sm lg:text-lg"
                placeholder={t("Scan SKU atau Cari Produk...")}
                autoFocus
              />
            </div>
            <Button variant="navy" size="lg" className="h-12 shrink-0 justify-center px-5 xl:min-w-[170px]" onClick={openSkuScanner}>
              <Camera className="mr-2 h-5 w-5" /> {t("Scan SKU")}
            </Button>
            <Button variant="outline" size="lg" className="h-12 shrink-0 justify-center px-5 text-[#0f172a] xl:min-w-[160px]" onClick={() => setManualItemOpen(true)}>
              <PackagePlus className="mr-2 h-5 w-5" /> {t("Add Item")}
            </Button>
            <Button variant="secondary" size="lg" className="h-12 shrink-0 justify-center px-5 text-[#0f172a] xl:min-w-[210px]" onClick={loadProducts}>
              <RefreshCw className="mr-2 h-5 w-5" /> {t("Refresh Produk")}
            </Button>
          </div>


          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {categories.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={category === item ? "shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm" : "shrink-0 rounded-full border border-[#d7e2dc] bg-white px-5 py-2.5 text-sm font-semibold text-[#475569] hover:border-primary hover:bg-primary/5"}>{t(item)}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-white text-sm font-medium text-[#64748b]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat produk...")}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-white text-center text-sm font-medium text-[#64748b]">{t("Belum ada produk. Tambahkan produk di halaman Inventaris, atau klik Add Item untuk item manual.")}</div>
          ) : (
            <div className="pos-grid">
              {filteredProducts.map((product) => {
                const cartQty = cart.find((item) => item.id === product.id)?.qty ?? 0;

                return (
                  <button key={product.id} onClick={() => addToCart(product)} className="group overflow-hidden rounded-xl border border-[#d7e2dc] bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] active:scale-[0.98]">
                    <div className="relative h-28 overflow-hidden bg-[#f1f5f9] sm:h-32 lg:h-36">
                      <div className="flex h-full w-full items-center justify-center px-3 text-center text-xl font-black leading-tight text-primary sm:text-2xl lg:text-3xl"><span className="line-clamp-3">{product.name}</span></div>
                      <Badge variant={(product.stock ?? 0) < 8 ? "danger" : "default"} className="absolute right-3 top-3 normal-case tracking-normal">{t("Stok")}: {product.stock ?? "-"}</Badge>
                      {cartQty > 0 ? <Badge variant="success" className="absolute left-3 top-3 normal-case tracking-normal">Di cart: {cartQty}</Badge> : null}
                      {discountLabel(product) ? <Badge variant="warning" className="absolute bottom-3 left-3 normal-case tracking-normal">Diskon {discountLabel(product)}</Badge> : null}
                    </div>
                    <div className="p-3 lg:p-4">
                      <p className="line-clamp-2 min-h-[52px] text-lg font-black leading-tight text-[#0f172a] lg:min-h-[60px] lg:text-xl">{product.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          {productDiscountAmount(product) > 0 ? <p className="text-xs font-bold text-[#64748b] line-through">{formatCurrency(product.price)}</p> : null}
                          <p className="text-base font-extrabold text-primary lg:text-lg">{formatCurrency(productFinalPrice(product))}</p>
                        </div>
                        <span className="rounded-full border border-[#dbe6ef] bg-[#f8fafc] px-2 py-1 text-[11px] font-bold text-[#64748b]">SKU {product.sku.slice(-4)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] min-h-[280px] shrink-0 flex-col rounded-t-2xl border border-[#d7e2dc] bg-white shadow-[0_-18px_60px_rgba(15,23,42,0.20)] transition-transform duration-300 ease-out ${mobileCartOpen ? "translate-y-0" : "translate-y-[calc(100%-78px)]"} lg:static lg:z-auto lg:h-full lg:max-h-none lg:min-h-[360px] lg:w-[460px] lg:translate-y-0 lg:rounded-none lg:border-l lg:border-r-0 lg:border-t-0 lg:shadow-none`}>
        <div className="border-b border-[#e2e8f0] px-4 py-2.5 lg:p-6">
          <button
            type="button"
            onClick={() => setMobileCartOpen((open) => !open)}
            className="mb-1.5 flex w-full items-center justify-center text-[#64748b] lg:hidden"
            aria-label={mobileCartOpen ? "Tutup keranjang" : "Buka keranjang"}
          >
            <span className="mr-2 h-1.5 w-11 rounded-full bg-[#cbd5e1]" />
            {mobileCartOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <div className="relative flex items-center justify-between gap-3">
            <button type="button" onClick={() => setMobileCartOpen((open) => !open)} className="flex min-w-0 flex-1 items-center gap-3 text-left lg:pointer-events-none">
              <ShoppingCart className="h-5 w-5 shrink-0 text-primary lg:h-6 lg:w-6" />
              <div className="min-w-0">
                <h3 className="text-lg font-black leading-tight text-[#0f172a] lg:text-xl">{t("Keranjang")}</h3>
                <p className="text-xs font-semibold text-[#64748b]">{totalItems} item • {cart.length} {t("jenis barang")}</p>
              </div>
            </button>
            <div className="text-right lg:hidden">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748b]">{t("Total")}</p>
              <p className="text-base font-black text-primary">{formatCurrency(total)}</p>
            </div>
            <button
              type="button"
              onClick={() => setCartMenuOpen((open) => !open)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d7e2dc] bg-white text-[#0f172a] transition hover:border-primary hover:text-primary"
              aria-label="Menu keranjang"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {cartMenuOpen ? (
              <div className="absolute right-0 top-12 z-[60] w-56 overflow-hidden rounded-xl border border-[#d7e2dc] bg-white shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountModalOpen(true);
                    setCartMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#0f172a] hover:bg-[#f8fafc]"
                >
                  <CreditCard className="h-4 w-4 text-primary" />
                  {t("Atur Diskon")}
                </button>
                <button
                  type="button"
                  onClick={() => openPayment("debt")}
                  disabled={cart.length === 0}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#0f172a] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <NotebookPen className="h-4 w-4 text-primary" />
                  {t("Catat Hutang")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setCartMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("Bersihkan")}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="max-h-[32vh] flex-1 overflow-auto p-3 custom-scrollbar lg:max-h-none lg:p-5">
          {cart.length > 0 ? (
            <div className="sticky top-0 z-10 mb-3 bg-white/95 pb-2 backdrop-blur">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <Input
                  value={cartSearch}
                  onChange={(event) => setCartSearch(event.target.value)}
                  placeholder={t("Cari barang di keranjang...")}
                  className="h-10 rounded-xl border-[#d7e2dc] bg-white pl-10 text-sm font-semibold"
                />
              </div>
            </div>
          ) : null}
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center text-sm font-medium text-[#64748b]">{t("Keranjang masih kosong. Klik kartu produk di kiri, scan SKU lalu Enter, atau tekan Add Item untuk menambahkan barang.")}</div>
          ) : filteredCart.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 text-center text-sm font-semibold text-[#64748b]">{t("Barang tidak ditemukan di keranjang.")}</div>
          ) : (
            <div className="space-y-2 lg:space-y-3">
              {filteredCart.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#d7e2dc] bg-[#f8fafc] p-2.5 shadow-sm lg:p-3">
                  <div className="flex items-center gap-2.5 lg:gap-3">
                    <div className="hidden h-14 w-14 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 sm:block">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden px-1 text-center text-[10px] font-black leading-tight text-primary">{item.isManual ? "ADD" : item.name}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="truncate text-sm font-bold lg:text-base lg:font-semibold">{item.name}</p>{item.isManual ? <Badge variant="warning" className="normal-case tracking-normal">Manual</Badge> : null}</div>
                      <p className="text-sm font-bold text-primary">{formatCurrency(productFinalPrice(item))} × {item.qty}</p>
                      {productDiscountAmount(item) > 0 ? <p className="text-xs font-semibold text-amber-700">{t("Diskon item")} {formatCurrency(productDiscountAmount(item))} / pcs</p> : null}
                    </div>
                    <button onClick={() => updateQty(item.id, 0)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50 lg:h-9 lg:w-9"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-[minmax(0,140px)_auto] items-end gap-2 lg:mt-3 lg:grid-cols-[1fr_auto] lg:gap-3">
                    <div className="grid grid-cols-3 items-center gap-1.5 rounded-xl bg-white p-1.5 lg:gap-2 lg:p-2">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} className="flex h-8 items-center justify-center rounded-lg border border-[#bccac0] lg:h-9"><Minus className="h-4 w-4" /></button>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(event) => updateQty(item.id, Number(event.target.value))}
                        className="h-8 px-1 text-center text-sm font-bold lg:h-9 lg:px-2"
                        aria-label={`Quantity ${item.name}`}
                      />
                      <button onClick={() => updateQty(item.id, item.qty + 1)} className="flex h-8 items-center justify-center rounded-lg border border-[#bccac0] lg:h-9"><Plus className="h-4 w-4" /></button>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d4a42] lg:text-[11px] lg:tracking-[0.16em]">Subtotal</p>
                      <p className="text-sm font-extrabold text-[#0b1c30] lg:text-lg">{formatCurrency(productFinalPrice(item) * item.qty)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#d7e2dc] bg-[#eef6f3] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:p-6">
          <div className="space-y-2 text-sm lg:space-y-3 lg:text-base">
            <div className="flex justify-between"><span>{t("Total qty")}</span><span>{totalItems} item</span></div>
            <div className="flex justify-between"><span>{t("Subtotal barang × qty")}</span><span>{formatCurrency(subtotal)}</span></div>
            {checkoutDiscountAmount > 0 ? <div className="flex justify-between text-amber-700"><span>{t("Diskon Transaksi")}</span><span>-{formatCurrency(checkoutDiscountAmount)}</span></div> : null}
            <div className="flex justify-between border-t border-[#d7e2dc] pt-2 font-black text-[#0f172a] lg:pt-3"><span>{t("Total")}</span><span className="text-primary">{formatCurrency(total)}</span></div>
          </div>

          <div className="mt-3 grid gap-2 lg:mt-6 lg:gap-3">
            <Button size="lg" onClick={() => openPayment("cash")} disabled={cart.length === 0} className="h-11 w-full rounded-lg text-sm lg:h-12 lg:text-base"><CreditCard className="mr-2 h-4 w-4 lg:h-5 lg:w-5" /> {t("Tunai (Cash)")}</Button>
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              <Button size="lg" variant="outline" onClick={() => openPayment("qris_static")} disabled={cart.length === 0} className="h-11 rounded-lg px-2 text-sm lg:h-12 lg:px-3 lg:text-base"><QrCode className="mr-1.5 h-4 w-4" /> QRIS Statis</Button>
              <Button size="lg" variant="outline" onClick={() => openPayment("qris_pakasir")} disabled={cart.length === 0 || !isOnline} className="h-11 rounded-lg px-2 text-sm lg:h-12 lg:px-3 lg:text-base"><WalletCards className="mr-1.5 h-4 w-4" /> QRIS KasirKita</Button>
            </div>
          </div>
        </div>
      </aside>

      <Modal open={skuScannerOpen} title={t("Scan SKU Kamera")} description={t("Arahkan kamera ke barcode produk. SKU yang cocok langsung masuk keranjang.")} onClose={() => setSkuScannerOpen(false)}>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-[#bccac0] bg-[#0b1c30]">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-[78%] rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(11,28,48,0.35)]" />
              <ScanLine className="absolute h-10 w-10 text-emerald-200" />
            </div>
            {scannerStarting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0b1c30]/50 text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("Membuka kamera...")}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-[#eff4ff] p-4 text-sm font-semibold text-[#3d4a42]">
            <p>{t(scannerMessage)}</p>
            {lastScannedSku ? <p className="mt-2 text-primary">{t("Terakhir terbaca")}: {lastScannedSku}</p> : null}
            <p className="mt-2 text-xs font-medium">
              {t("Di HP, kamera hanya aktif pada HTTPS. Gunakan domain Vercel/HTTPS untuk testing dari perangkat lain.")}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSkuScannerOpen(false)}>
              {t("Tutup")}
            </Button>
            <Button onClick={openSkuScanner} disabled={scannerStarting}>
              {scannerStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              {t("Scan Ulang")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={manualItemOpen} title={t("Add Item Manual")} description={t("Tambahkan item langsung ke keranjang tanpa harus terdaftar di inventaris.")} onClose={() => setManualItemOpen(false)}>
        {error ? (
          <div className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            <p>{error}</p>
            <UpgradeSubscriptionCta message={error} />
          </div>
        ) : null}
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{t("Nama item")}</Label>
              <Input value={manualItem.name} onChange={(event) => setManualItem((current) => ({ ...current, name: event.target.value }))} placeholder={t("Contoh: Es batu tambahan")} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>{t("SKU / Kode opsional")}</Label>
              <Input value={manualItem.sku} onChange={(event) => setManualItem((current) => ({ ...current, sku: event.target.value }))} placeholder={t("Auto jika kosong")} />
            </div>
            <div className="space-y-2">
              <Label>{t("Quantity")}</Label>
              <Input type="number" min={1} value={manualItem.quantity} onChange={(event) => setManualItem((current) => ({ ...current, quantity: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("Harga per item")}</Label>
              <Input type="number" min={0} value={manualItem.price} onChange={(event) => setManualItem((current) => ({ ...current, price: event.target.value }))} placeholder={t("Contoh 15000")} />
            </div>
          </div>
          <div className="rounded-2xl bg-[#eff4ff] p-4">
            <p className="text-sm font-semibold text-[#3d4a42]">{t("Subtotal manual")}</p>
            <p className="text-3xl font-extrabold text-primary">{formatCurrency((Number(manualItem.price) || 0) * (Number(manualItem.quantity) || 0))}</p>
            <p className="mt-1 text-xs text-[#3d4a42]">{t("Rumus: harga per item × quantity.")}</p>
          </div>
          <Button className="w-full" size="lg" onClick={addManualItem}>
            <PackagePlus className="mr-2 h-5 w-5" /> {t("Tambahkan ke Keranjang")}
          </Button>
        </div>
      </Modal>

      <Modal open={discountModalOpen} title={t("Diskon Transaksi")} description={t("Atur diskon untuk seluruh keranjang tanpa memenuhi area payment.")} onClose={() => setDiscountModalOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#eff4ff] p-4">
            <p className="text-sm font-semibold text-[#3d4a42]">{t("Subtotal barang × qty")}</p>
            <p className="text-3xl font-black text-[#0f172a]">{formatCurrency(subtotal)}</p>
            {checkoutDiscountAmount > 0 ? <p className="mt-1 text-sm font-bold text-amber-700">-{formatCurrency(checkoutDiscountAmount)}</p> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Mode Diskon")}</Label>
              <select value={checkoutDiscountType} onChange={(event) => setCheckoutDiscountType(event.target.value as DiscountType)} className="h-11 w-full rounded-xl border border-[#cbd5e1] bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary">
                <option value="none">{t("Tanpa Diskon")}</option>
                <option value="percent">{t("Persen")}</option>
                <option value="amount">{t("Nominal Rupiah")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("Nilai Diskon")}</Label>
              <Input
                type="number"
                min={0}
                max={checkoutDiscountType === "percent" ? 100 : undefined}
                value={checkoutDiscountValue}
                onChange={(event) => setCheckoutDiscountValue(event.target.value)}
                disabled={checkoutDiscountType === "none"}
                placeholder={checkoutDiscountType === "percent" ? "10" : "5000"}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-[#bccac0] bg-white p-4">
            <div className="flex justify-between text-sm font-semibold text-[#3d4a42]"><span>{t("Subtotal")}</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="mt-2 flex justify-between text-sm font-semibold text-amber-700"><span>{t("Diskon")}</span><span>-{formatCurrency(checkoutDiscountAmount)}</span></div>
            <div className="mt-3 flex justify-between border-t border-[#d7e2dc] pt-3 text-lg font-black text-[#0f172a]"><span>{t("Total")}</span><span className="text-primary">{formatCurrency(total)}</span></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => {
                setCheckoutDiscountType("none");
                setCheckoutDiscountValue("");
              }}
            >
              {t("Reset Diskon")}
            </Button>
            <Button onClick={() => setDiscountModalOpen(false)}>{t("Simpan Diskon")}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={paymentMethod !== null} title={paymentMethod ? methodLabel[paymentMethod] : "Pembayaran"} description="Transaksi dikirim ke API route backend dan disimpan ke SQLite lokal." onClose={() => !submitting ? setPaymentMethod(null) : undefined}>
        {error ? (
          <div className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            <p>{error}</p>
            <UpgradeSubscriptionCta message={error} />
          </div>
        ) : null}

        {paymentMethod === "cash" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#eff4ff] p-4">
              <p className="text-sm text-[#3d4a42]">Total</p>
              {checkoutDiscountAmount > 0 ? <p className="text-sm font-semibold text-[#3d4a42]">Subtotal {formatCurrency(subtotal)} • Diskon -{formatCurrency(checkoutDiscountAmount)}</p> : null}
              <p className="text-4xl font-extrabold text-primary">{formatCurrency(total)}</p>
            </div>
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
              {checkoutDiscountAmount > 0 ? <p className="text-xs text-[#3d4a42]">Diskon -{formatCurrency(checkoutDiscountAmount)}</p> : null}
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
                <img src={pakasirPayment.qrImageDataUrl} alt={`QRIS KasirKita ${pakasirPayment.orderId}`} className="h-full w-full rounded-2xl object-contain" />
              ) : (
                <div className="flex h-60 w-60 flex-col items-center justify-center rounded-2xl bg-[#eff4ff] p-6 text-[#3d4a42]">
                  <QrCode className="mb-3 h-16 w-16" />
                  <p className="text-sm font-semibold">Membuat QRIS KasirKita...</p>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-bold">Order ID {pakasirPayment?.orderId ?? "Membuat order..."}</p>
              <p className="text-sm text-[#3d4a42]">Nominal barang {formatCurrency(total)}</p>
              {pakasirPayment?.fee ? <p className="text-xs text-[#3d4a42]">Fee QRIS {formatCurrency(pakasirPayment.fee)} • Total bayar {formatCurrency(pakasirPayment.totalPayment ?? total)}</p> : null}
              {pakasirPayment?.expiredAt ? <p className="text-xs text-[#3d4a42]">Expired: {new Date(pakasirPayment.expiredAt).toLocaleString("id-ID")}</p> : null}
              <Badge variant={paymentStatus === "paid" ? "success" : paymentStatus === "failed" ? "danger" : "warning"} className="mt-3 normal-case tracking-normal">
                {paymentStatus === "paid" ? "Paid / Success" : paymentStatus === "failed" ? "Gagal" : "Menunggu pembayaran QRIS KasirKita"}
              </Badge>
            </div>
            {pakasirPayment?.paymentUrl ? (
              <a href={pakasirPayment.paymentUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary hover:bg-[#eff4ff]">
                Buka halaman bayar QRIS KasirKita
              </a>
            ) : null}
            <Button variant="outline" onClick={() => setPaymentMethod(null)} disabled={submitting}>Batal</Button>
          </div>
        ) : null}

        {paymentMethod === "debt" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#213145] p-4 text-white"><div className="flex items-center justify-between"><div><p className="text-sm text-white/70">Nominal Hutang</p>{checkoutDiscountAmount > 0 ? <p className="text-xs text-white/70">Diskon -{formatCurrency(checkoutDiscountAmount)}</p> : null}<p className="text-4xl font-extrabold">{formatCurrency(total)}</p></div><NotebookPen className="h-10 w-10 text-emerald-200" /></div></div>
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
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(11,28,48,0.28)]">
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-primary ring-8 ring-emerald-50">
              <CheckCircle2 className="h-14 w-14" />
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#3d4a42]">{successSummary.queued ? "Tersimpan offline" : "Pembayaran selesai"}</p>
            <h3 className="mt-2 text-3xl font-extrabold text-[#0b1c30]">{successSummary.queued ? "Masuk Antrean" : "Transaksi Berhasil"}</h3>
            <p className="mt-3 text-sm text-[#3d4a42]">
              {methodLabel[successSummary.method]} • {successSummary.totalItems} item
            </p>
            {successSummary.queued ? <p className="mt-2 text-sm font-semibold text-amber-700">Akan dikirim otomatis saat internet kembali.</p> : null}
            <p className="mt-4 text-4xl font-black text-primary">{formatCurrency(successSummary.total)}</p>
            {lastReceipt ? (
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-[#eff4ff] p-3 text-left">
                  <Label className="text-xs font-bold uppercase tracking-[0.16em] text-[#3d4a42]">{t("Ukuran Struk")}</Label>
                  <select value={receiptPaperWidth} onChange={(event) => setReceiptPaperWidth(event.target.value as ReceiptPaperWidth)} className="mt-2 h-10 w-full rounded-xl border border-[#bccac0] bg-white px-3 text-sm font-bold">
                    <option value="58mm">58mm ({t("thermal kecil")})</option>
                    <option value="80mm">80mm ({t("thermal besar")})</option>
                  </select>
                </div>
                <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <Button onClick={() => directPrintThermalReceipt(lastReceipt)} disabled={directPrinting} className="h-12">
                    {directPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} {t("Print")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setReceiptMenuOpen((open) => !open)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary bg-white text-primary transition hover:bg-primary/5"
                    aria-label="Menu struk"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {receiptMenuOpen ? (
                    <div className="absolute right-0 top-14 z-[90] w-52 overflow-hidden rounded-xl border border-[#d7e2dc] bg-white text-left shadow-2xl">
                      <button
                        type="button"
                        onClick={() => {
                          shareWhatsAppReceipt(lastReceipt);
                          setReceiptMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-[#0f172a] hover:bg-[#f8fafc]"
                      >
                        <Send className="h-4 w-4 text-primary" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          copyReceiptLink(lastReceipt);
                          setReceiptMenuOpen(false);
                        }}
                        disabled={!lastReceipt.publicUrl}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-[#0f172a] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4 text-primary" />
                        {t("Salin Link")}
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="rounded-xl bg-[#eff4ff] px-3 py-2 text-left text-xs font-semibold text-[#3d4a42]">
                  {t("Print memakai direct printer Bluetooth thermal di Chrome/Edge.")}
                </p>
                <Button onClick={startNewTransaction}>Transaksi Baru</Button>
              </div>
            ) : (
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#eff4ff]">
                <div className="h-full w-full animate-pulse rounded-full bg-primary" />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
