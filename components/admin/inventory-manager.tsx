"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Camera, Download, FileSpreadsheet, Loader2, Pencil, Plus, Power, PowerOff, RefreshCw, Save, Search, ScanLine, Upload, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { api, type ProductRecord } from "@/lib/api-client";
import { cacheProducts, initializeOfflinePos, readCachedProducts, subscribeOfflineData } from "@/lib/offline-pos";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppLanguage } from "@/lib/i18n";
import { UpgradeSubscriptionCta } from "@/components/subscription/upgrade-cta";

async function compressPhotoForUpload(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Browser tidak dapat memproses gambar ini.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Gagal mengompres gambar.")), "image/webp", 0.78));
    return new File([blob], "product.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}

type BulkPriceInput = { quantity: string; total: string };

function validatedBulkPrices(rows: BulkPriceInput[], unitPrice: number) {
  if (rows.some((row) => !row.quantity.trim() || !row.total.trim())) throw new Error("Isi jumlah dan harga total untuk setiap paket.");
  const offers = rows.map((row) => ({ quantity: Number(row.quantity), total: Number(row.total) }));
  if (offers.some((offer) => !Number.isInteger(offer.quantity) || offer.quantity < 2 || !Number.isSafeInteger(offer.total) || offer.total < 0 || offer.total >= unitPrice * offer.quantity)) {
    throw new Error("Setiap harga paket harus punya jumlah minimal 2 dan total lebih kecil dari harga satuan × jumlah.");
  }
  if (new Set(offers.map((offer) => offer.quantity)).size !== offers.length) throw new Error("Jumlah paket tidak boleh duplikat.");
  return offers;
}

function BulkPriceFields({ rows, setRows }: { rows: BulkPriceInput[]; setRows: Dispatch<SetStateAction<BulkPriceInput[]>> }) {
  return <div className="space-y-2 rounded-xl border border-[#dbe6ef] bg-[#f8fafc] p-3">
    <div><Label>Harga Paket Berdasarkan Jumlah</Label><p className="text-xs text-[#64748b]">Contoh: 2 pcs total Rp5.000, 3 pcs total Rp8.000. Berlaku otomatis di kasir dan toko online.</p></div>
    {rows.map((row, index) => <div key={index} className="flex items-end gap-2">
      <div className="min-w-0 flex-1"><Label>Jumlah (pcs)</Label><Input type="number" min={2} step={1} value={row.quantity} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, quantity: event.target.value } : item))} placeholder="2" /></div>
      <div className="min-w-0 flex-1"><Label>Harga total (Rp)</Label><Input type="number" min={0} step={1} value={row.total} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, total: event.target.value } : item))} placeholder="5000" /></div>
      <Button type="button" variant="outline" size="icon" aria-label={`Hapus harga paket ${index + 1}`} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><X className="h-4 w-4" /></Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, { quantity: "", total: "" }])}><Plus className="mr-1 h-4 w-4" />Tambah Harga Paket</Button>
  </div>;
}

export function InventoryManager() {
  const { t } = useAppLanguage();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const repairInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "amount">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [bulkPrices, setBulkPrices] = useState<BulkPriceInput[]>([]);
  const [stock, setStock] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairPreview, setRepairPreview] = useState<{ file: File; matchedProducts: number; correctedProducts: number; repairedTransactionItems: number; skippedProducts: number; unmatchedRows: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"none" | "percent" | "amount">("none");
  const [editDiscountValue, setEditDiscountValue] = useState("");
  const [editBulkPrices, setEditBulkPrices] = useState<BulkPriceInput[]>([]);
  const [editStock, setEditStock] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const stopScanner = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
  }, []);

  const closeScanner = useCallback(() => {
    stopScanner();
    setScannerOpen(false);
    setScannerStarting(false);
  }, [stopScanner]);

  useEffect(() => {
    if (!scannerOpen || !scannerVideoRef.current) return;
    let active = true;
    setScannerStarting(true);
    setScannerError(null);

    async function startScanner() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Kamera membutuhkan HTTPS atau localhost.");
        }
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 180, delayBetweenScanSuccess: 500 });
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          scannerVideoRef.current!,
          (result) => {
            if (!result || !active) return;
            setSku(result.getText().trim());
            closeScanner();
          },
        );
        if (!active) controls.stop();
        else scannerControlsRef.current = controls;
      } catch (error) {
        if (active) setScannerError(error instanceof Error ? error.message : "Gagal membuka kamera.");
      } finally {
        if (active) setScannerStarting(false);
      }
    }
    startScanner();
    return () => { active = false; stopScanner(); };
  }, [closeScanner, scannerOpen, stopScanner]);

  async function loadProducts(background = false) {
    const cached = readCachedProducts();
    if (cached?.products.length) {
      setItems(cached.products);
      setLoading(false);
    } else if (!background) {
      setLoading(true);
    }
    if (!background) setError(null);

    try {
      const rows = await api.products.list();
      setItems(rows);
      cacheProducts(rows);
    } catch (err) {
      if (cached?.products.length) {
        setItems(cached.products);
        if (typeof navigator !== "undefined" && navigator.onLine) {
          setError(`Sinkronisasi inventaris tertunda. Cache terakhir: ${new Date(cached.cachedAt).toLocaleString("id-ID")}.`);
        }
      } else {
        setError(err instanceof Error ? err.message : "Gagal memuat produk");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = readCachedProducts();
    if (cached?.products.length) {
      setItems(cached.products);
      setLoading(false);
    }
    void initializeOfflinePos().then(() => {
      const hydrated = readCachedProducts();
      if (hydrated?.products.length) {
        setItems(hydrated.products);
        setLoading(false);
      }
      void loadProducts(Boolean(hydrated?.products.length));
    });
    return subscribeOfflineData(() => {
      const current = readCachedProducts();
      if (current?.products.length) setItems(current.products);
    });
  }, []);
  function resetForm() {
    setName("");
    setSku("");
    setPrice("");
    setCostPrice("");
    setDiscountType("none");
    setDiscountValue("");
    setBulkPrices([]);
    setStock("");
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => item.name.toLowerCase().includes(keyword) || item.sku.toLowerCase().includes(keyword) || item.shopName?.toLowerCase().includes(keyword));
  }, [items, search]);

  function discountLabel(product: ProductRecord) {
    const type = product.discountType ?? "none";
    const value = product.discountValue ?? 0;
    if (type === "percent" && value > 0) return `${value}%`;
    if (type === "amount" && value > 0) return formatCurrency(value);
    return "-";
  }

  async function addProduct() {
    if (!name || !price) {
      setError("Nama barang dan harga jual wajib diisi. SKU boleh dikosongkan.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let created = await api.products.create({
        name,
        sku,
        price: Number(price),
        costPrice: Number(costPrice || 0),
        discountType,
        discountValue: discountType === "none" ? 0 : Number(discountValue || 0),
        bulkPrices: validatedBulkPrices(bulkPrices, Number(price)),
        stock: stock ? Number(stock) : null,
        photoUrl: "",
      });
      if (photoFile) {
        const compressed = await compressPhotoForUpload(photoFile);
        created = (await api.products.uploadPhoto(created.id, compressed)).product;
      }
      setItems((current) => [created, ...current]);
      cacheProducts([created, ...items]);
      setMessage("Produk berhasil disimpan ke database.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan produk");
    } finally {
      setSaving(false);
    }
  }

  function openEditProduct(product: ProductRecord) {
    setEditingProduct(product);
    setEditName(product.name || "");
    setEditSku(product.sku || "");
    setEditPrice(String(product.price ?? ""));
    setEditCostPrice(String(product.costPrice ?? 0));
    setEditDiscountType(product.discountType ?? "none");
    setEditDiscountValue(String(product.discountValue ?? ""));
    setEditBulkPrices((product.bulkPrices ?? []).map((offer) => ({ quantity: String(offer.quantity), total: String(offer.total) })));
    setEditStock(product.stock === null || product.stock === undefined ? "" : String(product.stock));
    setEditPhotoFile(null);
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = "";
    setEditError(null);
  }

  function closeEditProduct() {
    if (editSaving) return;
    setEditingProduct(null);
    setEditError(null);
  }

  async function saveEditProduct() {
    if (!editingProduct) return;
    if (!editName || !editPrice) {
      setEditError("Nama barang dan harga jual wajib diisi. SKU tetap boleh dikosongkan.");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    setError(null);
    setMessage(null);
    try {
      let updated = await api.products.update(editingProduct.id, {
        name: editName,
        sku: editSku,
        price: Number(editPrice),
        costPrice: Number(editCostPrice || 0),
        discountType: editDiscountType,
        discountValue: editDiscountType === "none" ? 0 : Number(editDiscountValue || 0),
        bulkPrices: validatedBulkPrices(editBulkPrices, Number(editPrice)),
        stock: editStock ? Number(editStock) : null,
      });
      if (editPhotoFile) {
        const compressed = await compressPhotoForUpload(editPhotoFile);
        updated = (await api.products.uploadPhoto(editingProduct.id, compressed)).product;
      }
      setItems((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      cacheProducts(items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setMessage("Produk berhasil diperbarui.");
      setEditingProduct(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui produk");
    } finally {
      setEditSaving(false);
    }
  }

  async function setProductActive(id: string, isActive: boolean) {
    setError(null);
    setMessage(null);
    try {
      const updated = await api.products.update(id, { isActive });
      const nextItems = items.map((item) => item.id === updated.id ? { ...item, ...updated } : item);
      setItems(nextItems);
      cacheProducts(nextItems);
      setMessage(isActive ? t("Produk berhasil diaktifkan.") : t("Produk berhasil dinonaktifkan."));
    } catch (err) {
      setError(err instanceof Error ? err.message : isActive ? t("Gagal mengaktifkan produk") : t("Gagal menonaktifkan produk"));
    }
  }

  async function downloadProductsFile(format: "template" | "csv") {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(`/api/products?format=${format}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        let message = "Gagal mengunduh file produk";
        try {
          const payload = await response.json();
          message = payload?.error?.message || message;
        } catch {
          // Keep default message for non-JSON response.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] || (format === "template" ? "template-produk-kasirkita.csv" : "produk-kasirkita.csv");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh file produk");
    } finally {
      setDownloading(false);
    }
  }

  async function importProducts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.products.importCsv(file);
      setMessage(`Import selesai: ${result.created} produk baru, ${result.updated} produk diperbarui, ${result.repairedTransactionItems} item transaksi lama dikoreksi.`);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal import produk");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function previewCostRepair(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRepairing(true);
    setRepairPreview(null);
    setError(null);
    try {
      const result = await api.products.repairCosts(file, false);
      setRepairPreview({ file, ...result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memeriksa CSV harga modal");
    } finally {
      setRepairing(false);
      if (repairInputRef.current) repairInputRef.current.value = "";
    }
  }

  async function applyCostRepair() {
    if (!repairPreview) return;
    setRepairing(true);
    setError(null);
    try {
      const result = await api.products.repairCosts(repairPreview.file, true);
      setMessage(`Perbaikan selesai: ${result.correctedProducts} harga modal produk dan ${result.repairedTransactionItems} item transaksi lama dikoreksi. Stok dan harga jual tidak berubah.`);
      setRepairPreview(null);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbaiki harga modal");
    } finally {
      setRepairing(false);
    }
  }

  return (
    <>
      <div className="grid w-full min-w-0 max-w-full gap-6 overflow-hidden xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>{t("Input Barang")}</CardTitle>
            <CardDescription>{t("Kelola produk, harga, modal, dan stok toko.")}</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 max-w-full space-y-4 overflow-hidden px-4 sm:px-6">
            {error ? (
              <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                <p>{error}</p>
                <UpgradeSubscriptionCta message={error} />
              </div>
            ) : null}
            {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" className="w-full px-3" onClick={() => downloadProductsFile("template")} disabled={downloading || importing}>
                <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" /> <span className="truncate">{t("Template CSV")}</span>
              </Button>
              <Button type="button" variant="outline" className="w-full px-3" onClick={() => importInputRef.current?.click()} disabled={importing || downloading}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Upload className="mr-2 h-4 w-4 shrink-0" />} <span className="truncate">{t("Import CSV")}</span>
              </Button>
              <Button type="button" variant="outline" className="w-full px-3" onClick={() => downloadProductsFile("csv")} disabled={downloading || importing}>
                {downloading ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Download className="mr-2 h-4 w-4 shrink-0" />} <span className="truncate">{t("Export CSV")}</span>
              </Button>
              <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importProducts} className="hidden" />
            </div>
            <p className="rounded-xl border border-[#dbe6ef] bg-[#f8fafc] p-3 text-xs font-semibold leading-relaxed text-[#64748b]">{t("Download template, kolom SKU/nama/harga/stok/diskon sudah terpisah di Excel. Isi data lalu Save As CSV sebelum import.")}</p>
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-bold text-amber-900">Perbaiki harga modal dari CSV lama</p>
              <p className="text-amber-800">Gunakan file CSV asli yang memiliki koma desimal. Pratinjau dan perbaikan ini hanya mengubah harga modal yang cocok dengan kesalahan impor lama; stok, harga jual, dan diskon tetap.</p>
              <input ref={repairInputRef} type="file" accept=".csv,text/csv" onChange={previewCostRepair} className="hidden" />
              <Button type="button" variant="outline" size="sm" disabled={repairing || importing} onClick={() => repairInputRef.current?.click()}>{repairing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Pilih CSV untuk pratinjau</Button>
              {repairPreview ? <div className="space-y-2 rounded-lg border border-amber-300 bg-white p-3">
                <p className="font-semibold">{repairPreview.file.name}: {repairPreview.matchedProducts} produk cocok; {repairPreview.correctedProducts} harga modal produk dan {repairPreview.repairedTransactionItems} item transaksi akan dikoreksi.</p>
                {repairPreview.skippedProducts || repairPreview.unmatchedRows ? <p className="text-xs text-amber-800">{repairPreview.skippedProducts} produk dengan modal baru berbeda dilewati; {repairPreview.unmatchedRows} SKU tidak ditemukan.</p> : null}
                <Button type="button" size="sm" disabled={repairing || (repairPreview.correctedProducts === 0 && repairPreview.repairedTransactionItems === 0)} onClick={applyCostRepair}>Terapkan perbaikan harga modal</Button>
              </div> : null}
            </div>
            <div className="space-y-2"><Label>{t("Nama Barang")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Contoh: Gula 1kg")} /></div>
            <div className="space-y-2"><Label>{t("Harga Jual")}</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="15000" /></div>
            <div className="space-y-2"><Label>{t("Harga Modal")}</Label><Input value={costPrice} onChange={(e) => setCostPrice(e.target.value)} type="number" placeholder="12500" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("Tipe Diskon")}</Label>
                <select value={discountType} onChange={(event) => setDiscountType(event.target.value as "none" | "percent" | "amount")} className="flex h-11 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-bold text-[#0f172a] outline-none transition hover:border-[#9fb4aa] focus:ring-2 focus:ring-primary">
                  <option value="none">{t("Tanpa Diskon")}</option>
                  <option value="percent">{t("Persen")}</option>
                  <option value="amount">{t("Nominal Rupiah")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("Nilai Diskon")}</Label>
                <Input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" min={0} max={discountType === "percent" ? 100 : undefined} disabled={discountType === "none"} placeholder={discountType === "percent" ? "10" : "2000"} />
              </div>
            </div>
            <BulkPriceFields rows={bulkPrices} setRows={setBulkPrices} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SKU / Barcode <span className="text-xs font-normal text-[#64748b]">({t("opsional")})</span></Label>
                <div className="flex gap-2">
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder={t("Auto jika kosong")} className="min-w-0" />
                  <Button type="button" variant="outline" size="icon" title="Scan barcode SKU" aria-label="Scan barcode SKU" onClick={() => setScannerOpen(true)}><ScanLine className="h-5 w-5" /></Button>
                </div>
              </div>
              <div className="space-y-2"><Label>{t("Stok")}</Label><Input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="50" /></div>
            </div>

            <div className="space-y-2">
              <Label>{t("Foto Produk")} <span className="text-xs font-normal text-[#64748b]">({t("Pro/Business")})</span></Label>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" className="w-full" onClick={() => photoInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" /> {photoFile ? photoFile.name : t("Pilih Foto Produk")}
              </Button>
              <p className="text-xs font-semibold leading-relaxed text-[#64748b]">{t("Gambar akan dikompres otomatis menjadi WebP agar tetap jelas dan hemat penyimpanan.")}</p>
            </div>

<div className="grid min-w-0 grid-cols-1 gap-2">
              <Button onClick={addProduct} disabled={saving} className="w-full min-w-0 px-3">{saving ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Plus className="mr-2 h-4 w-4 shrink-0" />} <span className="min-w-0 truncate">{t("Simpan")}</span></Button>
            </div>
</CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{t("Daftar Produk")}</CardTitle>
                <CardDescription>{t("Semua produk di toko ini, termasuk yang nonaktif.")}</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3d4a42]" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Cari barang, SKU, atau UMKM...")} className="h-10 pl-9 sm:w-72" />
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadProducts()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> {t("Refresh")}</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto">
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat produk...")}</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{t("Barang")}</TableHead><TableHead>SKU</TableHead><TableHead>{t("Harga Jual")}</TableHead><TableHead>{t("Harga Modal")}</TableHead><TableHead>{t("Diskon")}</TableHead><TableHead>Harga Paket</TableHead><TableHead>{t("Stok")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead>{t("Aksi")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
<TableCell className="font-bold text-[#0f172a]"><div className="flex min-w-44 items-center gap-3">{item.photoUrl ? <img src={item.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg border object-cover" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Camera className="h-5 w-5 text-slate-400" /></div>}<span>{item.name}{item.shopName ? <Badge className="ml-2" variant="secondary">{item.shopName}</Badge> : null}</span></div></TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{formatCurrency(item.price)}</TableCell>
                      <TableCell>{formatCurrency(item.costPrice)}</TableCell>
                      <TableCell>{discountLabel(item)}</TableCell>
                      <TableCell>{item.bulkPrices?.length ? [...item.bulkPrices].sort((a, b) => a.quantity - b.quantity).map((offer) => `${offer.quantity} pcs: ${formatCurrency(offer.total)}`).join(" · ") : "-"}</TableCell>
                      <TableCell>{item.stock ?? "-"}</TableCell>
                      <TableCell><Badge variant={item.isActive === false ? "secondary" : "success"}>{item.isActive === false ? t("Nonaktif") : t("Aktif")}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openEditProduct(item)}><Pencil className="mr-2 h-4 w-4" /> {t("Edit")}</Button>
                          {item.isActive === false ? (
                            <Button variant="outline" size="sm" onClick={() => setProductActive(item.id, true)}><Power className="mr-2 h-4 w-4" /> {t("Aktifkan")}</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setProductActive(item.id, false)}><PowerOff className="mr-2 h-4 w-4" /> {t("Nonaktifkan")}</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={Boolean(editingProduct)}
        title={t("Edit Produk")}
        description={t("Ubah nama barang, SKU, harga jual, harga modal, diskon, dan stok. SKU boleh dikosongkan; sistem akan membuat SKU otomatis.")}
        onClose={closeEditProduct}
      >
        <div className="space-y-4">
          {editError ? (
            <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              <p>{editError}</p>
              <UpgradeSubscriptionCta message={editError} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>{t("Nama Barang")}</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t("Contoh: Gula 1kg")} />
          </div>
          <div className="space-y-2">
            <Label>SKU / Barcode <span className="text-xs font-normal text-[#64748b]">({t("opsional")})</span></Label>
            <Input value={editSku} onChange={(e) => setEditSku(e.target.value)} placeholder={t("Kosongkan untuk auto SKU")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Harga Jual")}</Label>
              <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" placeholder="15000" />
            </div>
            <div className="space-y-2">
              <Label>{t("Harga Modal")}</Label>
              <Input value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} type="number" placeholder="12500" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Tipe Diskon")}</Label>
              <select value={editDiscountType} onChange={(event) => setEditDiscountType(event.target.value as "none" | "percent" | "amount")} className="flex h-11 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-bold text-[#0f172a] outline-none transition hover:border-[#9fb4aa] focus:ring-2 focus:ring-primary">
                <option value="none">{t("Tanpa Diskon")}</option>
                <option value="percent">{t("Persen")}</option>
                <option value="amount">{t("Nominal Rupiah")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("Nilai Diskon")}</Label>
              <Input value={editDiscountValue} onChange={(e) => setEditDiscountValue(e.target.value)} type="number" min={0} max={editDiscountType === "percent" ? 100 : undefined} disabled={editDiscountType === "none"} placeholder={editDiscountType === "percent" ? "10" : "2000"} />
            </div>
          </div>
          <BulkPriceFields rows={editBulkPrices} setRows={setEditBulkPrices} />
          <div className="space-y-2">
            <Label>{t("Stok")}</Label>
            <Input value={editStock} onChange={(e) => setEditStock(e.target.value)} type="number" placeholder="50" />
          </div>
          <div className="space-y-2">
            <Label>{t("Foto Produk")} <span className="text-xs font-normal text-[#64748b]">({t("Pro/Business")})</span></Label>
            {editingProduct?.photoUrl ? <img src={editingProduct.photoUrl} alt={editingProduct.name} className="h-28 w-28 rounded-xl border object-cover" /> : null}
            <input ref={editPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setEditPhotoFile(event.target.files?.[0] ?? null)} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => editPhotoInputRef.current?.click()}><Camera className="mr-2 h-4 w-4" /> {editPhotoFile ? editPhotoFile.name : t("Pilih Foto Baru")}</Button>
              {editingProduct?.photoUrl ? <Button type="button" variant="outline" onClick={async () => { try { const updated = await api.products.removePhoto(editingProduct.id); setEditingProduct(updated); setItems((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item)); } catch (err) { setEditError(err instanceof Error ? err.message : "Gagal menghapus foto"); } }}>{t("Hapus Foto")}</Button> : null}
            </div>
            <p className="text-xs font-semibold text-[#64748b]">{t("Gambar akan dikompres otomatis menjadi WebP agar tetap jelas dan hemat penyimpanan.")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={closeEditProduct} disabled={editSaving}>{t("Tutup")}</Button>
            <Button type="button" onClick={saveEditProduct} disabled={editSaving}>
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t("Simpan Perubahan")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={scannerOpen} title="Scan Barcode SKU" description="Arahkan kamera ke barcode produk. Kode akan masuk otomatis ke kolom SKU." onClose={closeScanner}>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-2">
            <video ref={scannerVideoRef} className="aspect-video w-full rounded-xl object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-emerald-300/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
          </div>
          <p className="text-sm font-semibold text-slate-600">{scannerStarting ? "Meminta izin kamera..." : scannerError || "Arahkan barcode ke dalam kotak."}</p>
          <Button type="button" variant="outline" className="w-full" onClick={closeScanner}><X className="mr-2 h-4 w-4" /> Tutup Scanner</Button>
        </div>
      </Modal>
    </>
  );
}
