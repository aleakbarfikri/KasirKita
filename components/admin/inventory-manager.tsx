"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, FileSpreadsheet, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { api, type ProductRecord } from "@/lib/api-client";
import { cacheProducts, readCachedProducts } from "@/lib/offline-pos";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppLanguage } from "@/lib/i18n";

export function InventoryManager() {
  const { t } = useAppLanguage();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.products.list();
      setItems(rows);
      cacheProducts(rows);
    } catch (err) {
      const cached = readCachedProducts();
      if (cached?.products.length) {
        setItems(cached.products);
        setError(`Mode offline: produk memakai cache terakhir (${new Date(cached.cachedAt).toLocaleString("id-ID")}).`);
      } else {
        setError(err instanceof Error ? err.message : "Gagal memuat produk");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);
  function resetForm() {
    setName("");
    setSku("");
    setPrice("");
    setCostPrice("");
    setStock("");
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
      const created = await api.products.create({
        name,
        sku,
        price: Number(price),
        costPrice: Number(costPrice || 0),
        stock: stock ? Number(stock) : null,
        photoUrl: "",
      });
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
    setEditStock(product.stock === null || product.stock === undefined ? "" : String(product.stock));
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
      const updated = await api.products.update(editingProduct.id, {
        name: editName,
        sku: editSku,
        price: Number(editPrice),
        costPrice: Number(editCostPrice || 0),
        stock: editStock ? Number(editStock) : null,
      });
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

  async function deleteProduct(id: string) {
    setError(null);
    try {
      await api.products.remove(id);
      setItems((current) => current.filter((item) => item.id !== id));
      cacheProducts(items.filter((item) => item.id !== id));
      setMessage("Produk dinonaktifkan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus produk");
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
      setMessage(`Import selesai: ${result.created} produk baru, ${result.updated} produk diperbarui.`);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal import produk");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <>
      <div className="grid w-full min-w-0 max-w-full gap-6 overflow-hidden xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>{t("Input Barang")}</CardTitle>
            <CardDescription>{t("Kelola produk, harga, modal, dan stok toko.")}</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 max-w-full space-y-4 overflow-hidden px-4 sm:px-6">
            {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
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
            <p className="rounded-2xl bg-[#eff4ff] p-3 text-xs font-semibold leading-relaxed text-[#3d4a42]">{t("Download template, kolom SKU/nama/harga/stok sudah terpisah di Excel. Isi data lalu Save As CSV sebelum import.")}</p>
            <div className="space-y-2"><Label>{t("Nama Barang")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Contoh: Gula 1kg")} /></div>
            <div className="space-y-2"><Label>{t("Harga Jual")}</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="15000" /></div>
            <div className="space-y-2"><Label>{t("Harga Modal")}</Label><Input value={costPrice} onChange={(e) => setCostPrice(e.target.value)} type="number" placeholder="12500" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>SKU / Barcode <span className="text-xs font-normal text-[#3d4a42]">({t("opsional")})</span></Label><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder={t("Auto jika kosong")} /></div>
              <div className="space-y-2"><Label>{t("Stok")}</Label><Input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="50" /></div>
            </div>

<div className="grid min-w-0 grid-cols-1 gap-2">
              <Button onClick={addProduct} disabled={saving} className="w-full min-w-0 px-3">{saving ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Plus className="mr-2 h-4 w-4 shrink-0" />} <span className="min-w-0 truncate">{t("Simpan")}</span></Button>
            </div>
</CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t("Daftar Produk")}</CardTitle>
                <CardDescription>{t("Produk aktif di toko ini.")}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadProducts} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> {t("Refresh")}</Button>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto">
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Memuat produk...")}</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{t("Barang")}</TableHead><TableHead>SKU</TableHead><TableHead>{t("Harga Jual")}</TableHead><TableHead>{t("Harga Modal")}</TableHead><TableHead>{t("Stok")}</TableHead><TableHead>{t("Aksi")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
<TableCell className="font-medium">{item.name}{item.shopName ? <Badge className="ml-2" variant="secondary">{item.shopName}</Badge> : null}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{formatCurrency(item.price)}</TableCell>
                      <TableCell>{formatCurrency(item.costPrice)}</TableCell>
                      <TableCell>{item.stock ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openEditProduct(item)}><Pencil className="mr-2 h-4 w-4" /> {t("Edit")}</Button>
                          <Button variant="outline" size="sm" onClick={() => deleteProduct(item.id)}><Trash2 className="mr-2 h-4 w-4" /> {t("Nonaktifkan")}</Button>
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
        title="Edit Produk"
        description="Ubah nama barang, SKU, harga jual, harga modal, dan stok. SKU boleh dikosongkan; sistem akan membuat SKU otomatis."
        onClose={closeEditProduct}
      >
        <div className="space-y-4">
          {editError ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{editError}</p> : null}
          <div className="space-y-2">
            <Label>Nama Barang</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Contoh: Gula 1kg" />
          </div>
          <div className="space-y-2">
            <Label>SKU / Barcode <span className="text-xs font-normal text-[#3d4a42]">(opsional)</span></Label>
            <Input value={editSku} onChange={(e) => setEditSku(e.target.value)} placeholder="Kosongkan untuk auto SKU" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Harga Jual</Label>
              <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" placeholder="15000" />
            </div>
            <div className="space-y-2">
              <Label>Harga Modal</Label>
              <Input value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} type="number" placeholder="12500" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Stok</Label>
            <Input value={editStock} onChange={(e) => setEditStock(e.target.value)} type="number" placeholder="50" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={closeEditProduct} disabled={editSaving}>Batal</Button>
            <Button type="button" onClick={saveEditProduct} disabled={editSaving}>
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
