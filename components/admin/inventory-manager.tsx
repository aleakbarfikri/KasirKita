"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, UploadCloud, X } from "lucide-react";
import { api, type ProductRecord } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function InventoryManager() {
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoName(file.name);
      setPhotoPreview(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhotoName("");
    setPhotoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetForm() {
    setName("");
    setSku("");
    setPrice("");
    setCostPrice("");
    setStock("");
    clearPhoto();
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
        photoUrl: photoPreview || "",
      });
      setItems((current) => [created, ...current]);
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
      setMessage("Produk dinonaktifkan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus produk");
    }
  }

  return (
    <>
      <div className="grid w-full min-w-0 max-w-full gap-6 overflow-hidden xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Input Barang</CardTitle>
            <CardDescription>Data produk sekarang disimpan melalui API Route Handler + SQLite lokal.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 max-w-full space-y-4 overflow-hidden px-4 sm:px-6">
            {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
            <div className="space-y-2"><Label>Nama Barang</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Gula 1kg" /></div>
            <div className="space-y-2"><Label>Harga Jual</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="15000" /></div>
            <div className="space-y-2"><Label>Harga Modal</Label><Input value={costPrice} onChange={(e) => setCostPrice(e.target.value)} type="number" placeholder="12500" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>SKU / Barcode <span className="text-xs font-normal text-[#3d4a42]">(opsional)</span></Label><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto jika kosong" /></div>
              <div className="space-y-2"><Label>Stok</Label><Input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="50" /></div>
            </div>

            <div className="min-w-0 space-y-2">
              <Label>Foto Produk <span className="text-xs font-normal text-[#3d4a42]">(opsional)</span></Label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              {photoPreview ? (
                <div className="min-w-0 overflow-hidden rounded-2xl border border-[#bccac0] bg-[#f8f9ff]">
                  <div className="relative h-48 bg-[#dae2fd]">
                    <img src={photoPreview} alt="Preview foto produk" className="h-full w-full object-cover" />
                    <button type="button" onClick={clearPhoto} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#0b1c30] shadow-sm hover:bg-white" aria-label="Hapus foto">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-3 p-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-[#0b1c30]">{photoName}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Ganti</Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full min-w-0 max-w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#bccac0] bg-[#f8f9ff] px-3 py-6 text-center transition-colors hover:border-primary hover:bg-[#eff4ff] sm:px-4 sm:py-8">
                  <div className="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dae2fd] text-primary"><ImagePlus className="h-6 w-6" /></div>
                  <p className="w-full max-w-full break-words px-2 text-center font-bold text-[#0b1c30]">Upload foto produk</p>
                  <p className="mt-1 w-full max-w-full break-words px-2 text-center text-sm leading-relaxed text-[#3d4a42]">PNG, JPG, atau foto dari kamera. Bisa dikosongkan.</p>
                </button>
              )}
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" type="button" className="w-full min-w-0 px-3"><Camera className="mr-2 h-4 w-4 shrink-0" /> <span className="min-w-0 truncate">Scan</span></Button>
              <Button onClick={addProduct} disabled={saving} className="w-full min-w-0 px-3">{saving ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Plus className="mr-2 h-4 w-4 shrink-0" />} <span className="min-w-0 truncate">Simpan</span></Button>
            </div>
            <Button type="button" variant="secondary" className="w-full min-w-0 px-3" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="mr-2 h-4 w-4 shrink-0" /> <span className="min-w-0 truncate">Pilih Foto Produk</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Daftar Produk</CardTitle>
                <CardDescription>Terhubung ke endpoint <code>/api/products</code>.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadProducts} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto">
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat produk...</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Foto</TableHead><TableHead>Barang</TableHead><TableHead>SKU</TableHead><TableHead>Harga Jual</TableHead><TableHead>Harga Modal</TableHead><TableHead>Stok</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="h-14 w-14 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
                          {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-extrabold text-primary">KK</div>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}{item.shopName ? <Badge className="ml-2" variant="secondary">{item.shopName}</Badge> : null}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{formatCurrency(item.price)}</TableCell>
                      <TableCell>{formatCurrency(item.costPrice)}</TableCell>
                      <TableCell>{item.stock ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openEditProduct(item)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => deleteProduct(item.id)}><Trash2 className="mr-2 h-4 w-4" /> Nonaktifkan</Button>
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
