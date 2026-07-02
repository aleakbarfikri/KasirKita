"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CalendarDays, CheckCircle2, Edit3, ImagePlus, Loader2, MessageCircle, Plus, QrCode, RefreshCw, ShieldCheck, Upload, UserCheck, UserX, X } from "lucide-react";
import { api, type CashierRow, type OwnerAdminRow } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function normalizeUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function whatsappHref(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isExpired(activeUntil?: string | null) {
  return Boolean(activeUntil && activeUntil < todayJakarta());
}

function formatActiveUntil(activeUntil?: string | null) {
  if (!activeUntil) return "Tanpa batas";
  return new Date(`${activeUntil}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function adminEffectiveActive(row?: OwnerAdminRow) {
  return Boolean(row?.profile.isActive && !isExpired(row.profile.activeUntil));
}

function cashierStatus(row: CashierRow, admin?: OwnerAdminRow) {
  if (row.profile.approvalStatus === "pending") return { label: "Menunggu Approval", variant: "warning" as const };
  if (row.profile.approvalStatus === "rejected") return { label: "Ditolak", variant: "danger" as const };
  if (!row.profile.isActive) return { label: "Nonaktif", variant: "secondary" as const };
  if (!adminEffectiveActive(admin)) return { label: "Admin Nonaktif", variant: "warning" as const };
  return { label: "Aktif", variant: "success" as const };
}

export function AdminManagement() {
  const [admins, setAdmins] = useState<OwnerAdminRow[]>([]);
  const [cashiers, setCashiers] = useState<CashierRow[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [activeUntil, setActiveUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<OwnerAdminRow | null>(null);
  const [editShopName, setEditShopName] = useState("");
  const [editShopAddress, setEditShopAddress] = useState("");
  const [editShopPhone, setEditShopPhone] = useState("");
  const [editActiveUntil, setEditActiveUntil] = useState("");
  const [editQrisImage, setEditQrisImage] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const qrisInputRef = useRef<HTMLInputElement | null>(null);

  async function loadAdmins() {
    setLoading(true);
    setError(null);
    try {
      const [rows, cashierRows] = await Promise.all([api.owner.admins.list(), api.owner.cashiers.list()]);
      setAdmins(rows);
      setCashiers(cashierRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function addAdmin() {
    const normalizedUsername = normalizeUsername(username);
    if (!name.trim() || !normalizedUsername || !email.trim() || !password || !shopName.trim()) {
      setError("Nama, username, email, password, dan nama UMKM wajib diisi.");
      return;
    }
    if (normalizedUsername.length < 3) {
      setError("Username minimal 3 karakter. Gunakan huruf, angka, atau underscore.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.owner.admins.create({
        name: name.trim(),
        username: normalizedUsername,
        email: email.trim(),
        password,
        shopName: shopName.trim(),
        shopAddress: shopAddress.trim(),
        shopPhone: shopPhone.trim(),
        activeUntil,
      });
      setAdmins((current) => [created, ...current]);
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setShopName("");
      setShopAddress("");
      setShopPhone("");
      setActiveUntil("");
      setMessage(`Admin berhasil dibuat. Username login: ${created.admin.username || normalizedUsername}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat admin");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: OwnerAdminRow) {
    setEditing(row);
    setEditShopName(row.shop.name ?? "");
    setEditShopAddress(row.shop.address ?? "");
    setEditShopPhone(row.shop.phone ?? "");
    setEditActiveUntil(row.profile.activeUntil ?? "");
    setEditQrisImage(row.shop.qrisStaticImageUrl ?? "");
    setEditError(null);
  }

  function handleQrisUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEditError("File QRIS harus berupa gambar PNG/JPG.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setEditQrisImage(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editShopName.trim()) {
      setEditError("Nama UMKM wajib diisi.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    setMessage(null);
    try {
      const updated = await api.owner.admins.update(editing.admin.id, {
        shopName: editShopName.trim(),
        shopAddress: editShopAddress.trim(),
        shopPhone: editShopPhone.trim(),
        activeUntil: editActiveUntil || null,
        qrisStaticImageUrl: editQrisImage,
      });
      setAdmins((current) => current.map((row) => row.admin.id === updated.admin.id ? updated : row));
      setEditing(null);
      setMessage("Data admin, nama UMKM, dan QRIS statis berhasil diperbarui.");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan admin");
    } finally {
      setEditSaving(false);
    }
  }

  async function setAdminActive(id: string, isActive: boolean) {
    setError(null);
    setMessage(null);
    try {
      const updated = await api.owner.admins.update(id, { isActive });
      setAdmins((current) => current.map((row) => row.admin.id === id ? updated : row));
      setMessage(isActive ? "Admin berhasil diaktifkan kembali." : "Admin berhasil dinonaktifkan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : isActive ? "Gagal mengaktifkan admin" : "Gagal menonaktifkan admin");
    }
  }

  async function approveCashier(id: string) {
    setError(null);
    setMessage(null);
    try {
      const updated = await api.owner.cashiers.approve(id);
      setCashiers((current) => current.map((row) => row.cashier.id === updated.cashier.id ? updated : row));
      setMessage("Kasir berhasil disetujui dan sudah bisa login.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal approve kasir");
    }
  }

  const pendingCashiers = cashiers.filter((row) => row.profile.approvalStatus === "pending");

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      {pendingCashiers.length > 0 ? (
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Approval Kasir Tambahan</CardTitle>
            <CardDescription>Kasir kedua dan seterusnya perlu persetujuan owner sebelum bisa login.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Kasir</TableHead><TableHead>UMKM</TableHead><TableHead>Dibuat Oleh</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
              <TableBody>
                {pendingCashiers.map((row) => {
                  const admin = admins.find((item) => item.admin.id === row.profile.adminId);
                  return (
                    <TableRow key={row.cashier.id}>
                      <TableCell><p className="font-bold">{row.cashier.name}</p><p className="text-xs text-[#3d4a42]">{row.cashier.username}</p></TableCell>
                      <TableCell>{row.shop.name}</TableCell>
                      <TableCell>{admin?.admin.name || "-"}</TableCell>
                      <TableCell><Badge variant="warning">Menunggu Approval</Badge></TableCell>
                      <TableCell><Button size="sm" onClick={() => approveCashier(row.cashier.id)}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tambahkan Admin UMKM</CardTitle>
          
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          <div className="space-y-2"><Label>Nama Admin</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ayu Lestari" /></div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} placeholder="admin_cabang_4" autoCapitalize="none" autoCorrect="off" />
            <p className="text-xs text-[#3d4a42]">Gunakan huruf kecil, angka, atau underscore. Contoh: admin_cabang_4</p>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin4@kasirkita.test" /></div>
          <div className="space-y-2"><Label>Password Awal</Label><Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="minimal 8 karakter" /></div>
          <div className="space-y-2"><Label>Nama UMKM/Cabang</Label><Input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="UMKM Sumber Rezeki" /></div>
          <div className="space-y-2"><Label>Alamat Cabang</Label><Input value={shopAddress} onChange={(event) => setShopAddress(event.target.value)} placeholder="Jl. Melati No. 10" /></div>
          <div className="space-y-2"><Label>Nomer Telpon</Label><Input value={shopPhone} onChange={(event) => setShopPhone(event.target.value)} placeholder="08xxxxxxxxxx" /></div>
          <div className="space-y-2">
            <Label>Masa Aktif Sampai</Label>
            <Input type="date" value={activeUntil} onChange={(event) => setActiveUntil(event.target.value)} min={todayJakarta()} />
            <p className="text-xs text-[#3d4a42]">Kosongkan jika admin tidak memakai batas subscription.</p>
          </div>
          <Button className="w-full" onClick={addAdmin} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Buat Admin</Button>
          <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground"><ShieldCheck className="mb-2 h-5 w-5" /> QRIS statis per cabang bisa ditambahkan setelah admin dibuat lewat tombol Edit.</div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Daftar Admin</CardTitle>
              <CardDescription>Kelola akun cabang, nama UMKM, QRIS statis, dan saldo QRIS Pakasir.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadAdmins}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat admin...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Nama UMKM</TableHead>
                  <TableHead>Alamat Toko</TableHead>
                  <TableHead>Nomer Telpon</TableHead>
                  <TableHead>QRIS Statis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Masa Aktif</TableHead>
                  <TableHead>Saldo QRIS Pakasir</TableHead>
                  <TableHead>Total Withdrawn</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((row) => {
                  const balance = row.balance;
                  const available = (balance?.totalEarnedQrisApi ?? 0) - (balance?.totalWithdrawn ?? 0);
                  const waHref = whatsappHref(row.shop.phone);
                  const expired = isExpired(row.profile.activeUntil);
                  const effectiveActive = row.profile.isActive && !expired;
                  return (
                    <TableRow key={row.admin.id}>
                      <TableCell><p className="font-medium">{row.admin.username || row.admin.email}</p><p className="text-xs text-[#3d4a42]">{row.admin.name}</p></TableCell>
                      <TableCell className="min-w-[150px] align-middle"><p className="font-bold text-[#0b1c30]">{row.shop.name}</p></TableCell>
                      <TableCell className="min-w-[180px] align-middle"><p className="max-w-[220px] whitespace-normal text-sm leading-relaxed text-[#3d4a42]">{row.shop.address || "Tanpa alamat"}</p></TableCell>
                      <TableCell>
                        {row.shop.phone ? (
                          <a href={waHref || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                            <MessageCircle className="h-4 w-4" />
                            {row.shop.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-[#3d4a42]">Belum ada</span>
                        )}
                      </TableCell>
                      <TableCell>{row.shop.qrisStaticImageUrl ? <Badge variant="success" className="normal-case tracking-normal"><QrCode className="mr-1 h-3.5 w-3.5" /> Ada QRIS</Badge> : <Badge variant="secondary" className="normal-case tracking-normal">Belum ada</Badge>}</TableCell>
                      <TableCell><Badge variant={effectiveActive ? "success" : expired ? "warning" : "secondary"}>{effectiveActive ? "Aktif" : expired ? "Expired" : "Nonaktif"}</Badge></TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2 rounded-full bg-[#eff4ff] px-3 py-1.5 text-sm font-bold text-[#0b1c30]">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          {formatActiveUntil(row.profile.activeUntil)}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(Math.max(available, 0))}</TableCell>
                      <TableCell>{formatCurrency(balance?.totalWithdrawn ?? 0)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(row)}><Edit3 className="mr-2 h-4 w-4" /> Edit</Button>
                          {row.profile.isActive ? (
                            <Button variant="outline" size="sm" onClick={() => setAdminActive(row.admin.id, false)}><UserX className="mr-2 h-4 w-4" /> Nonaktifkan</Button>
                          ) : (
                            <Button variant="secondary" size="sm" onClick={() => setAdminActive(row.admin.id, true)}><UserCheck className="mr-2 h-4 w-4" /> Aktifkan</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Daftar Akun Kasir</CardTitle>
              <CardDescription>Semua kasir yang dibuat admin. Jika admin nonaktif atau expired, kasir otomatis ikut tidak bisa login.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadAdmins}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-[#3d4a42]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat kasir...</div>
          ) : cashiers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#bccac0] bg-[#f8f9ff] p-8 text-center text-sm font-semibold text-[#3d4a42]">Belum ada akun kasir yang dibuat admin.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>UMKM</TableHead>
                  <TableHead>Admin Pembuat</TableHead>
                  <TableHead>Status Kasir</TableHead>
                  <TableHead>Status Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashiers.map((row) => {
                  const admin = admins.find((item) => item.admin.id === row.profile.adminId);
                  const status = cashierStatus(row, admin);
                  const adminExpired = isExpired(admin?.profile.activeUntil);
                  const adminStatus = adminEffectiveActive(admin) ? "Aktif" : adminExpired ? "Expired" : "Nonaktif";
                  return (
                    <TableRow key={row.cashier.id}>
                      <TableCell><p className="font-bold text-[#0b1c30]">{row.cashier.name}</p><p className="text-xs text-[#3d4a42]">{row.cashier.email}</p></TableCell>
                      <TableCell>{row.cashier.username || "-"}</TableCell>
                      <TableCell>{row.shop.name}</TableCell>
                      <TableCell>{admin?.admin.name || "-"}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={adminEffectiveActive(admin) ? "success" : adminExpired ? "warning" : "secondary"}>{adminStatus}</Badge>
                          <p className="text-xs text-[#3d4a42]">Masa aktif: {formatActiveUntil(admin?.profile.activeUntil)}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal open={editing !== null} title="Edit Admin UMKM" description="Edit nama UMKM dan QRIS statis yang akan tampil di pembayaran QRIS Statis milik admin ini." onClose={() => !editSaving ? setEditing(null) : undefined}>
        {editing ? (
          <div className="space-y-4">
            {editError ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{editError}</p> : null}
            <div className="rounded-2xl bg-[#eff4ff] p-4 text-sm">
              <p className="font-bold text-[#0b1c30]">{editing.admin.name}</p>
              <p className="text-[#3d4a42]">Username: {editing.admin.username || editing.admin.email}</p>
            </div>
            <div className="space-y-2"><Label>Nama UMKM/Cabang</Label><Input value={editShopName} onChange={(event) => setEditShopName(event.target.value)} placeholder="UMKM Melati" /></div>
            <div className="space-y-2"><Label>Alamat Cabang</Label><Input value={editShopAddress} onChange={(event) => setEditShopAddress(event.target.value)} placeholder="Jl. Melati No. 12" /></div>
            <div className="space-y-2"><Label>Nomer Telpon</Label><Input value={editShopPhone} onChange={(event) => setEditShopPhone(event.target.value)} placeholder="08xxxxxxxxxx" /></div>
            <div className="space-y-2">
              <Label>Masa Aktif Subscription</Label>
              <Input type="date" value={editActiveUntil} onChange={(event) => setEditActiveUntil(event.target.value)} min={todayJakarta()} />
              <p className="text-xs text-[#3d4a42]">Kalau tanggal lewat, admin otomatis tidak bisa login/akses dashboard. Kosongkan untuk tanpa batas.</p>
            </div>

            <div className="space-y-2">
              <Label>QRIS Statis Pemilik UMKM</Label>
              <input ref={qrisInputRef} type="file" accept="image/*" onChange={handleQrisUpload} className="hidden" />
              <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#bccac0] bg-[#f8f9ff]">
                {editQrisImage ? (
                  <>
                    <img src={editQrisImage} alt="QRIS Statis Cabang" className="h-full max-h-80 w-full object-contain p-4" />
                    <button type="button" onClick={() => setEditQrisImage("")} className="absolute right-3 top-3 rounded-full bg-white p-2 shadow"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <div className="p-8 text-center text-[#3d4a42]">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#dae2fd] text-primary"><ImagePlus className="h-8 w-8" /></div>
                    <p className="font-semibold text-[#0b1c30]">Upload QRIS statis cabang</p>
                    <p className="text-xs">Gambar ini akan muncul saat admin memilih QRIS Statis di POS.</p>
                  </div>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={() => qrisInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Upload / Ganti QRIS</Button>
            </div>

            <Button className="w-full" size="lg" onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />} Simpan Perubahan
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
