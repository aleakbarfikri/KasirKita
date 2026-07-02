"use client";

import { useEffect, useState } from "react";

export type AppLanguage = "id" | "en";

const storageKey = "kasirkita:language";
const eventName = "kasirkita:language-change";

const dictionary: Record<string, { id: string; en: string }> = {
  Dashboard: { id: "Dashboard", en: "Dashboard" },
  "Admin Management": { id: "Manajemen Admin", en: "Admin Management" },
  "API Config": { id: "Konfigurasi API", en: "API Config" },
  Withdrawals: { id: "Withdraw", en: "Withdraw" },
  Withdraw: { id: "Withdraw", en: "Withdraw" },
  "Piutang Cabang": { id: "Piutang Cabang", en: "Branch Debts" },
  "POS Kasir": { id: "POS Kasir", en: "Cashier POS" },
  Inventaris: { id: "Inventaris", en: "Inventory" },
  "Transaction History": { id: "Riwayat Transaksi", en: "Transaction History" },
  "Shift Kasir": { id: "Shift Kasir", en: "Cashier Shift" },
  "Kelola Kasir": { id: "Kelola Kasir", en: "Manage Cashiers" },
  "Catatan Hutang": { id: "Catatan Hutang", en: "Debt Ledger" },
  "Tarik Dana": { id: "Withdraw", en: "Withdraw" },
  "Riwayat Penarikan": { id: "Riwayat Withdraw", en: "Withdraw History" },
  "Buat akun kasir, cek status approval owner, dan ubah password kasir.": {
    id: "Buat akun kasir, cek status approval owner, dan ubah password kasir.",
    en: "Create cashier accounts, check owner approval, and update cashier passwords.",
  },
  "Catatan transaksi tunai, QRIS statis, QRIS Pakasir, dan transaksi hutang.": {
    id: "Catatan transaksi tunai, QRIS statis, QRIS Pakasir, dan transaksi hutang.",
    en: "Cash, static QRIS, Pakasir QRIS, and debt transaction records.",
  },
  "Tutup shift, hitung uang tunai fisik, dan lihat rekap kasir.": {
    id: "Tutup shift, hitung uang tunai fisik, dan lihat rekap kasir.",
    en: "Close shifts, count physical cash, and review cashier summaries.",
  },
  "Ajukan penarikan saldo digital dari transaksi QRIS Pakasir sukses.": {
    id: "Ajukan penarikan saldo digital dari transaksi QRIS Pakasir sukses.",
    en: "Request a digital balance withdrawal from successful Pakasir QRIS transactions.",
  },
  "Lihat notifikasi withdraw dan tandai transfer manual sebagai selesai.": {
    id: "Lihat notifikasi withdraw dan tandai transfer manual sebagai selesai.",
    en: "Review withdraw notifications and mark manual transfers as complete.",
  },
  "Tambah Akun Kasir": { id: "Tambah Akun Kasir", en: "Add Cashier Account" },
  "Kasir pertama langsung aktif. Kasir kedua dan seterusnya perlu approval owner.": {
    id: "Kasir pertama langsung aktif. Kasir kedua dan seterusnya perlu approval owner.",
    en: "The first cashier is active immediately. Additional cashiers need owner approval.",
  },
  "Daftar Kasir": { id: "Daftar Kasir", en: "Cashier List" },
  "Kasir hanya dapat login ke POS dan Transaction History.": {
    id: "Kasir hanya dapat login ke POS dan Riwayat Transaksi.",
    en: "Cashiers can only access POS and Transaction History.",
  },
  "Nama Kasir": { id: "Nama Kasir", en: "Cashier Name" },
  Username: { id: "Username", en: "Username" },
  Email: { id: "Email", en: "Email" },
  "Password Awal": { id: "Password Awal", en: "Initial Password" },
  "minimal 8 karakter": { id: "minimal 8 karakter", en: "minimum 8 characters" },
  "Buat Kasir": { id: "Buat Kasir", en: "Create Cashier" },
  Kasir: { id: "Kasir", en: "Cashier" },
  Status: { id: "Status", en: "Status" },
  Aksi: { id: "Aksi", en: "Action" },
  Aktif: { id: "Aktif", en: "Active" },
  "Menunggu Owner": { id: "Menunggu Owner", en: "Waiting Owner" },
  "Tidak Aktif": { id: "Tidak Aktif", en: "Inactive" },
  "Ubah Password": { id: "Ubah Password", en: "Change Password" },
  Refresh: { id: "Refresh", en: "Refresh" },
  "Memuat kasir...": { id: "Memuat kasir...", en: "Loading cashiers..." },
  "Ubah Password Kasir": { id: "Ubah Password Kasir", en: "Change Cashier Password" },
  "Password baru langsung dipakai kasir untuk login berikutnya.": {
    id: "Password baru langsung dipakai kasir untuk login berikutnya.",
    en: "The new password is used on the cashier's next login.",
  },
  "Password Baru": { id: "Password Baru", en: "New Password" },
  "Simpan Password": { id: "Simpan Password", en: "Save Password" },
  "Login sebagai": { id: "Login sebagai", en: "Logged in as" },
  "Area Owner": { id: "Area Owner", en: "Owner Area" },
  "Area Admin": { id: "Area Admin", en: "Admin Area" },
  Admin: { id: "Admin", en: "Admin" },
  Owner: { id: "Owner", en: "Owner" },
  "Kasir UMKM": { id: "Kasir UMKM", en: "Store Cashier" },
  "Admin UMKM": { id: "Admin UMKM", en: "Store Admin" },
  "Owner Account": { id: "Owner Account", en: "Owner Account" },
  Logout: { id: "Logout", en: "Logout" },
  "Profil & Password": { id: "Profil & Password", en: "Profile & Password" },
  "Profil Akun": { id: "Profil Akun", en: "Account Profile" },
  "Kelola nama Owner, nama aplikasi/UMKM, dan password.": {
    id: "Kelola nama Owner, nama aplikasi/UMKM, dan password.",
    en: "Manage owner name, app/store name, and password.",
  },
  "Kelola nama admin, nama UMKM, dan password login.": {
    id: "Kelola nama admin, nama UMKM, dan password login.",
    en: "Manage admin name, store name, and login password.",
  },
  "Nama Owner": { id: "Nama Owner", en: "Owner Name" },
  "Nama Admin": { id: "Nama Admin", en: "Admin Name" },
  "Nama UMKM": { id: "Nama UMKM", en: "Store Name" },
  "Alamat Toko/UMKM": { id: "Alamat Toko/UMKM", en: "Store Address" },
  "No HP Toko": { id: "No HP Toko", en: "Store Phone" },
  "Ganti Password": { id: "Ganti Password", en: "Change Password" },
  "Password Lama": { id: "Password Lama", en: "Current Password" },
  "Konfirmasi Password": { id: "Konfirmasi Password", en: "Confirm Password" },
  "Manajemen Inventaris": { id: "Manajemen Inventaris", en: "Inventory Management" },
  "Input produk, harga jual, harga modal, dan SKU/barcode.": {
    id: "Input produk, harga jual, harga modal, dan SKU/barcode.",
    en: "Input products, selling price, cost, and SKU/barcode.",
  },
  "Buku hutang pelanggan: catat transaksi bayar nanti, pantau jatuh tempo, dan tandai lunas.": {
    id: "Buku hutang pelanggan: catat transaksi bayar nanti, pantau jatuh tempo, dan tandai lunas.",
    en: "Customer debt book: record pay-later sales, monitor due dates, and mark as paid.",
  },
  "Masukkan jumlah penarikan dari saldo QRIS Pakasir.": {
    id: "Masukkan jumlah penarikan dari saldo QRIS Pakasir.",
    en: "Enter the withdrawal amount from Pakasir QRIS balance.",
  },
  "Jumlah tidak boleh melebihi saldo digital tersedia.": {
    id: "Jumlah tidak boleh melebihi saldo digital tersedia.",
    en: "Amount cannot exceed the available digital balance.",
  },
  "Request akan muncul di dashboard Owner.": {
    id: "Request akan muncul di dashboard Owner.",
    en: "The request will appear on the Owner dashboard.",
  },
  "Hanya saldo dari QRIS Pakasir sukses yang dapat ditarik.": {
    id: "Hanya saldo dari QRIS Pakasir sukses yang dapat ditarik.",
    en: "Only successful Pakasir QRIS balance can be withdrawn.",
  },
  "Saldo Digital Tersedia": { id: "Saldo Digital Tersedia", en: "Available Digital Balance" },
  "Nama Bank": { id: "Nama Bank", en: "Bank Name" },
  "Nomor Rekening": { id: "Nomor Rekening", en: "Account Number" },
  "Atas Nama": { id: "Atas Nama", en: "Account Holder" },
  "Jumlah Penarikan": { id: "Jumlah Penarikan", en: "Withdrawal Amount" },
  "Ajukan Penarikan": { id: "Ajukan Penarikan", en: "Submit Withdrawal" },
  "Status Request": { id: "Status Request", en: "Request Status" },
  "Status berubah saat Owner menandai transfer selesai.": {
    id: "Status berubah saat Owner menandai transfer selesai.",
    en: "Status changes when the Owner marks the transfer as complete.",
  },
  Jumlah: { id: "Jumlah", en: "Amount" },
  "Input Barang": { id: "Input Barang", en: "Add Product" },
  "Kelola produk, harga, modal, dan stok toko.": {
    id: "Kelola produk, harga, modal, dan stok toko.",
    en: "Manage store products, prices, costs, and stock.",
  },
  "Nama Barang": { id: "Nama Barang", en: "Product Name" },
  "Contoh: Gula 1kg": { id: "Contoh: Gula 1kg", en: "Example: Sugar 1kg" },
  "Harga Jual": { id: "Harga Jual", en: "Selling Price" },
  "Harga Modal": { id: "Harga Modal", en: "Cost Price" },
  Diskon: { id: "Diskon", en: "Discount" },
  "Diskon item": { id: "Diskon item", en: "Item discount" },
  "Diskon Transaksi": { id: "Diskon Transaksi", en: "Transaction Discount" },
  "Tipe Diskon": { id: "Tipe Diskon", en: "Discount Type" },
  "Nilai Diskon": { id: "Nilai Diskon", en: "Discount Value" },
  "Tanpa Diskon": { id: "Tanpa Diskon", en: "No Discount" },
  Persen: { id: "Persen", en: "Percent" },
  "Nominal Rupiah": { id: "Nominal Rupiah", en: "Fixed Amount" },
  "Ukuran Struk": { id: "Ukuran Struk", en: "Receipt Size" },
  "thermal kecil": { id: "thermal kecil", en: "small thermal" },
  "thermal besar": { id: "thermal besar", en: "large thermal" },
  "Cari barang, SKU, atau UMKM...": { id: "Cari barang, SKU, atau UMKM...", en: "Search product, SKU, or store..." },
  "Edit Produk": { id: "Edit Produk", en: "Edit Product" },
  "Kosongkan untuk auto SKU": { id: "Kosongkan untuk auto SKU", en: "Leave empty for auto SKU" },
  "Simpan Perubahan": { id: "Simpan Perubahan", en: "Save Changes" },
  "Ubah nama barang, SKU, harga jual, harga modal, diskon, dan stok. SKU boleh dikosongkan; sistem akan membuat SKU otomatis.": {
    id: "Ubah nama barang, SKU, harga jual, harga modal, diskon, dan stok. SKU boleh dikosongkan; sistem akan membuat SKU otomatis.",
    en: "Update product name, SKU, selling price, cost, discount, and stock. SKU can be empty; the system will generate it automatically.",
  },
  opsional: { id: "opsional", en: "optional" },
  "Auto jika kosong": { id: "Auto jika kosong", en: "Auto if empty" },
  Stok: { id: "Stok", en: "Stock" },
  Simpan: { id: "Simpan", en: "Save" },
  "Daftar Produk": { id: "Daftar Produk", en: "Product List" },
  "Produk aktif di toko ini.": { id: "Produk aktif di toko ini.", en: "Active products in this store." },
  "Memuat produk...": { id: "Memuat produk...", en: "Loading products..." },
  Edit: { id: "Edit", en: "Edit" },
  Nonaktifkan: { id: "Nonaktifkan", en: "Deactivate" },
  "Total Belum Lunas": { id: "Total Belum Lunas", en: "Total Outstanding" },
  "Jatuh Tempo": { id: "Jatuh Tempo", en: "Overdue" },
  "Sudah Dibayar": { id: "Sudah Dibayar", en: "Paid" },
  "Input Hutang Manual": { id: "Input Hutang Manual", en: "Manual Debt Entry" },
  "Catat hutang pelanggan secara manual.": {
    id: "Catat hutang pelanggan secara manual.",
    en: "Record customer debt manually.",
  },
  "Nama pelanggan": { id: "Nama pelanggan", en: "Customer Name" },
  "Contoh Bu Lina": { id: "Contoh Bu Lina", en: "Example: Mrs. Lina" },
  "No. HP": { id: "No. HP", en: "Phone" },
  Nominal: { id: "Nominal", en: "Amount" },
  "Jatuh tempo": { id: "Jatuh tempo", en: "Due date" },
  "Catatan barang, alamat, atau kesepakatan pembayaran...": {
    id: "Catatan barang, alamat, atau kesepakatan pembayaran...",
    en: "Item notes, address, or payment agreement...",
  },
  "Tambah Catatan Hutang": { id: "Tambah Catatan Hutang", en: "Add Debt Record" },
  "Piutang Semua Cabang": { id: "Piutang Semua Cabang", en: "All Branch Receivables" },
  "Buku Hutang Pelanggan": { id: "Buku Hutang Pelanggan", en: "Customer Debt Book" },
  "Owner dapat memantau piutang lintas UMKM dan risiko jatuh tempo.": {
    id: "Owner dapat memantau piutang lintas UMKM dan risiko jatuh tempo.",
    en: "Owner can monitor receivables and overdue risk across stores.",
  },
  "Pantau pelanggan yang belum melunasi pembelian.": {
    id: "Pantau pelanggan yang belum melunasi pembelian.",
    en: "Monitor customers who have not paid off purchases.",
  },
  "Cari pelanggan/UMKM": { id: "Cari pelanggan/UMKM", en: "Search customer/store" },
  "Memuat buku hutang...": { id: "Memuat buku hutang...", en: "Loading debt book..." },
  Pelanggan: { id: "Pelanggan", en: "Customer" },
  Cabang: { id: "Cabang", en: "Branch" },
  Dibayar: { id: "Dibayar", en: "Paid" },
  "Produk dari database dan cache offline": { id: "Produk dari database dan cache offline", en: "Products from database and offline cache" },
  "Scan SKU atau Cari Produk...": { id: "Scan SKU atau Cari Produk...", en: "Scan SKU or search product..." },
  "Scan SKU": { id: "Scan SKU", en: "Scan SKU" },
  "Add Item": { id: "Tambah Item", en: "Add Item" },
  "Refresh Produk": { id: "Refresh Produk", en: "Refresh Products" },
  Semua: { id: "Semua", en: "All" },
  "Stok Rendah": { id: "Stok Rendah", en: "Low Stock" },
  Terbaru: { id: "Terbaru", en: "Newest" },
  "Belum ada produk. Tambahkan produk di halaman Inventaris, atau klik Add Item untuk item manual.": {
    id: "Belum ada produk. Tambahkan produk di halaman Inventaris, atau klik Add Item untuk item manual.",
    en: "No products yet. Add products from Inventory, or click Add Item for a manual item.",
  },
  Keranjang: { id: "Keranjang", en: "Cart" },
  "jenis barang": { id: "jenis barang", en: "item types" },
  Bersihkan: { id: "Bersihkan", en: "Clear" },
  "Keranjang masih kosong. Klik kartu produk di kiri, scan SKU lalu Enter, atau tekan Add Item untuk menambahkan barang.": {
    id: "Keranjang masih kosong. Klik kartu produk di kiri, scan SKU lalu Enter, atau tekan Add Item untuk menambahkan barang.",
    en: "Cart is still empty. Click a product card, scan SKU then Enter, or press Add Item.",
  },
  "Total qty": { id: "Total qty", en: "Total qty" },
  "Subtotal barang × qty": { id: "Subtotal barang × qty", en: "Item subtotal × qty" },
  "Tunai (Cash)": { id: "Tunai (Cash)", en: "Cash" },
  "Catat Hutang": { id: "Catat Hutang", en: "Record Debt" },
  "Add Item Manual": { id: "Tambah Item Manual", en: "Add Manual Item" },
  "Tambahkan item langsung ke keranjang tanpa harus terdaftar di inventaris.": {
    id: "Tambahkan item langsung ke keranjang tanpa harus terdaftar di inventaris.",
    en: "Add an item directly to the cart without registering it in inventory.",
  },
  "Nama item": { id: "Nama item", en: "Item name" },
  "Contoh: Es batu tambahan": { id: "Contoh: Es batu tambahan", en: "Example: Extra ice" },
  "SKU / Kode opsional": { id: "SKU / Kode opsional", en: "SKU / optional code" },
  Quantity: { id: "Quantity", en: "Quantity" },
  "Harga per item": { id: "Harga per item", en: "Price per item" },
  "Contoh 15000": { id: "Contoh 15000", en: "Example 15000" },
  "Subtotal manual": { id: "Subtotal manual", en: "Manual subtotal" },
  "Rumus: harga per item × quantity.": { id: "Rumus: harga per item × quantity.", en: "Formula: price per item × quantity." },
  "Tambahkan ke Keranjang": { id: "Tambahkan ke Keranjang", en: "Add to Cart" },
  "Scan SKU Kamera": { id: "Scan SKU Kamera", en: "Camera SKU Scan" },
  "Arahkan kamera ke barcode produk. SKU yang cocok langsung masuk keranjang.": {
    id: "Arahkan kamera ke barcode produk. SKU yang cocok langsung masuk keranjang.",
    en: "Point the camera at a product barcode. Matching SKUs are added to the cart.",
  },
  "Arahkan kamera ke barcode SKU produk.": { id: "Arahkan kamera ke barcode SKU produk.", en: "Point the camera at the product SKU barcode." },
  "Meminta izin kamera...": { id: "Meminta izin kamera...", en: "Requesting camera permission..." },
  "Kamera tidak tersedia di browser ini.": { id: "Kamera tidak tersedia di browser ini.", en: "Camera is not available in this browser." },
  "Kamera perlu HTTPS. Gunakan Vercel/HTTPS atau localhost saat testing.": {
    id: "Kamera perlu HTTPS. Gunakan Vercel/HTTPS atau localhost saat testing.",
    en: "Camera requires HTTPS. Use Vercel/HTTPS or localhost for testing.",
  },
  "Membuka kamera...": { id: "Membuka kamera...", en: "Opening camera..." },
  "Terakhir terbaca": { id: "Terakhir terbaca", en: "Last scanned" },
  "Di HP, kamera hanya aktif pada HTTPS. Gunakan domain Vercel/HTTPS untuk testing dari perangkat lain.": {
    id: "Di HP, kamera hanya aktif pada HTTPS. Gunakan domain Vercel/HTTPS untuk testing dari perangkat lain.",
    en: "On phones, camera access only works on HTTPS. Use the Vercel/HTTPS domain when testing from another device.",
  },
  Tutup: { id: "Tutup", en: "Close" },
  "Scan Ulang": { id: "Scan Ulang", en: "Scan Again" },
  "Pembayaran Tunai": { id: "Pembayaran Tunai", en: "Cash Payment" },
  "Pembayaran dari halaman utama dikirim ke API checkout backend.": {
    id: "Pembayaran dari halaman utama dikirim ke API checkout backend.",
    en: "Payment from the home screen is sent to the backend checkout API.",
  },
  "Total Belanja": { id: "Total Belanja", en: "Cart Total" },
  "item dalam keranjang": { id: "item dalam keranjang", en: "items in cart" },
  "Cari nama barang atau SKU...": { id: "Cari nama barang atau SKU...", en: "Search item name or SKU..." },
  Add: { id: "Tambah", en: "Add" },
  "Produk Database": { id: "Produk Database", en: "Database Products" },
  "Cari produk, klik barang, atau Add Item untuk mulai transaksi.": {
    id: "Cari produk, klik barang, atau Add Item untuk mulai transaksi.",
    en: "Search products, click an item, or use Add Item to start a transaction.",
  },
  "Add Item / Tambah Barang": { id: "Tambah Barang Manual", en: "Add Manual Item" },
  "Bisa langsung masuk keranjang, atau disimpan juga ke inventaris backend.": {
    id: "Bisa langsung masuk keranjang, atau disimpan juga ke inventaris backend.",
    en: "Add directly to the cart, or also save it to backend inventory.",
  },
  "Nama barang": { id: "Nama barang", en: "Product name" },
  "Contoh: Kopi Sachet": { id: "Contoh: Kopi Sachet", en: "Example: Coffee Sachet" },
  "SKU opsional": { id: "SKU opsional", en: "Optional SKU" },
  "Harga jual": { id: "Harga jual", en: "Selling price" },
  "Contoh 12000": { id: "Contoh 12000", en: "Example 12000" },
  "Harga modal": { id: "Harga modal", en: "Cost price" },
  "Stok awal jika disimpan ke inventaris": { id: "Stok awal jika disimpan ke inventaris", en: "Initial stock if saved to inventory" },
  Opsional: { id: "Opsional", en: "Optional" },
  "Simpan juga ke inventaris database": { id: "Simpan juga ke inventaris database", en: "Also save to database inventory" },
  Subtotal: { id: "Subtotal", en: "Subtotal" },
  "Tambahkan Barang": { id: "Tambahkan Barang", en: "Add Product" },
  "Total transaksi": { id: "Total transaksi", en: "Transaction total" },
  "Uang diterima": { id: "Uang diterima", en: "Cash received" },
  Kembalian: { id: "Kembalian", en: "Change" },
  "Selesaikan Transaksi": { id: "Selesaikan Transaksi", en: "Complete Transaction" },
  "Menyimpan...": { id: "Menyimpan...", en: "Saving..." },
  "Pembayaran Diterima": { id: "Pembayaran Diterima", en: "Payment Received" },
  Pembayaran: { id: "Pembayaran", en: "Payment" },
  "Contoh 100000": { id: "Contoh 100000", en: "Example 100000" },
  "QRIS Statis belum diupload": { id: "QRIS Statis belum diupload", en: "Static QRIS has not been uploaded" },
  "Upload dari Owner → Admin Management → Edit Admin.": {
    id: "Upload dari Owner → Admin Management → Edit Admin.",
    en: "Upload from Owner → Admin Management → Edit Admin.",
  },
  "Membuat QRIS...": { id: "Membuat QRIS...", en: "Creating QRIS..." },
  "Membuat order...": { id: "Membuat order...", en: "Creating order..." },
  "Nominal barang": { id: "Nominal barang", en: "Item amount" },
  "Total bayar": { id: "Total bayar", en: "Total payment" },
  "Menunggu pembayaran Pakasir": { id: "Menunggu pembayaran Pakasir", en: "Waiting for Pakasir payment" },
  "Buka halaman bayar Pakasir": { id: "Buka halaman bayar Pakasir", en: "Open Pakasir payment page" },
  "Nominal Hutang": { id: "Nominal Hutang", en: "Debt Amount" },
  "Contoh Pak Rudi": { id: "Contoh Pak Rudi", en: "Example: Mr. Rudi" },
  "Catatan hutang": { id: "Catatan hutang", en: "Debt note" },
  "Alamat, catatan pelanggan, dll": { id: "Alamat, catatan pelanggan, dll", en: "Address, customer note, etc." },
  "Simpan Hutang": { id: "Simpan Hutang", en: "Save Debt" },
  "Transaksi tersimpan offline. Akan sync otomatis saat internet kembali.": {
    id: "Transaksi tersimpan offline. Akan sync otomatis saat internet kembali.",
    en: "Transaction saved offline. It will sync automatically when internet returns.",
  },
  "Dashboard Admin": { id: "Dashboard Admin", en: "Admin Dashboard" },
  "Dashboard khusus UMKM/Cabang untuk saldo digital, omzet, transaksi, dan hutang pelanggan.": {
    id: "Dashboard khusus UMKM/Cabang untuk saldo digital, omzet, transaksi, dan hutang pelanggan.",
    en: "Dashboard for store balance, revenue, transactions, and customer debt.",
  },
  "UMKM Aktif": { id: "UMKM Aktif", en: "Active Store" },
  "Cabang yang sedang login": { id: "Cabang yang sedang login", en: "Current logged-in branch" },
  "Omzet Hari Ini": { id: "Omzet Hari Ini", en: "Today's Revenue" },
  "Tunai + QRIS sukses": { id: "Tunai + QRIS sukses", en: "Successful cash + QRIS" },
  "Laba Kotor Hari Ini": { id: "Laba Kotor Hari Ini", en: "Today's Gross Profit" },
  "Omzet - harga modal": { id: "Omzet - harga modal", en: "Revenue minus cost" },
  "Saldo Digital": { id: "Saldo Digital", en: "Digital Balance" },
  "QRIS Pakasir sukses - withdraw": { id: "QRIS Pakasir sukses - withdraw", en: "Successful Pakasir QRIS minus withdraw" },
  "Hutang Aktif": { id: "Hutang Aktif", en: "Active Debt" },
  "Belum lunas + sebagian": { id: "Belum lunas + sebagian", en: "Unpaid + partial" },
  "Aksi Cepat": { id: "Aksi Cepat", en: "Quick Actions" },
  "Operasi harian admin UMKM.": { id: "Operasi harian admin UMKM.", en: "Daily store admin operations." },
  "Buka Kasir POS": { id: "Buka Kasir POS", en: "Open Cashier POS" },
  "Ajukan Tarik Dana": { id: "Ajukan Tarik Dana", en: "Request Withdraw" },
  "Transaksi Cabang": { id: "Transaksi Cabang", en: "Branch Transactions" },
  "Riwayat singkat transaksi terbaru.": { id: "Riwayat singkat transaksi terbaru.", en: "Latest transaction summary." },
  Order: { id: "Order", en: "Order" },
  Barang: { id: "Barang", en: "Items" },
  Metode: { id: "Metode", en: "Method" },
  Total: { id: "Total", en: "Total" },
  Laba: { id: "Laba", en: "Profit" },
  Tanggal: { id: "Tanggal", en: "Date" },
  "Order ID": { id: "Order ID", en: "Order ID" },
  "Semua Transaksi": { id: "Semua Transaksi", en: "All Transactions" },
  "Rekap transaksi dan barang yang terjual.": { id: "Rekap transaksi dan barang yang terjual.", en: "Transaction recap and sold items." },
  "Export...": { id: "Export...", en: "Export..." },
  "Export CSV": { id: "Export CSV", en: "Export CSV" },
  "Template CSV": { id: "Template CSV", en: "CSV Template" },
  "Import CSV": { id: "Import CSV", en: "Import CSV" },
  "Download template, isi di Excel, lalu Save As CSV sebelum import.": {
    id: "Download template, isi di Excel, lalu Save As CSV sebelum import.",
    en: "Download the template, fill it in Excel, then Save As CSV before importing.",
  },
  "Download template, kolom SKU/nama/harga/stok sudah terpisah di Excel. Isi data lalu Save As CSV sebelum import.": {
    id: "Download template, kolom SKU/nama/harga/stok sudah terpisah di Excel. Isi data lalu Save As CSV sebelum import.",
    en: "Download the template; SKU/name/price/stock columns are already separated in Excel. Fill it in, then Save As CSV before importing.",
  },
  "Download template, kolom SKU/nama/harga/stok/diskon sudah terpisah di Excel. Isi data lalu Save As CSV sebelum import.": {
    id: "Download template, kolom SKU/nama/harga/stok/diskon sudah terpisah di Excel. Isi data lalu Save As CSV sebelum import.",
    en: "Download the template; SKU/name/price/stock/discount columns are already separated in Excel. Fill it in, then Save As CSV before importing.",
  },
  "Memuat transaksi...": { id: "Memuat transaksi...", en: "Loading transactions..." },
  "Memuat data...": { id: "Memuat data...", en: "Loading data..." },
  "Gagal memuat transaksi": { id: "Gagal memuat transaksi", en: "Failed to load transactions" },
  "Mode offline": { id: "Mode offline", en: "Offline mode" },
  "transaksi memakai cache terakhir": { id: "transaksi memakai cache terakhir", en: "transactions are using the latest cache" },
  Tunai: { id: "Tunai", en: "Cash" },
  "QRIS Statis": { id: "QRIS Statis", en: "Static QRIS" },
  "QRIS Pakasir": { id: "QRIS Pakasir", en: "Pakasir QRIS" },
  Hutang: { id: "Hutang", en: "Debt" },
  Menunggu: { id: "Menunggu", en: "Pending" },
  Sukses: { id: "Sukses", en: "Success" },
  Gagal: { id: "Gagal", en: "Failed" },
  Dibatalkan: { id: "Dibatalkan", en: "Cancelled" },
  "Tutup Shift": { id: "Tutup Shift", en: "Close Shift" },
  "Hitung transaksi sejak shift terakhir kasir sampai saat ini.": {
    id: "Hitung transaksi sejak shift terakhir kasir sampai saat ini.",
    en: "Calculate transactions from the last cashier shift until now.",
  },
  "Uang Tunai Fisik": { id: "Uang Tunai Fisik", en: "Physical Cash Count" },
  "Contoh: 250000": { id: "Contoh: 250000", en: "Example: 250000" },
  Catatan: { id: "Catatan", en: "Note" },
  "Tutup Shift Sekarang": { id: "Tutup Shift Sekarang", en: "Close Shift Now" },
  "Riwayat Shift": { id: "Riwayat Shift", en: "Shift History" },
  "Rekap tunai, QRIS, hutang, transaksi batal, dan laba kotor.": {
    id: "Rekap tunai, QRIS, hutang, transaksi batal, dan laba kotor.",
    en: "Cash, QRIS, debt, cancelled transaction, and gross profit summary.",
  },
  "Memuat shift...": { id: "Memuat shift...", en: "Loading shifts..." },
  "Belum ada shift yang ditutup.": { id: "Belum ada shift yang ditutup.", en: "No closed shifts yet." },
  Ditutup: { id: "Ditutup", en: "Closed" },
  Transaksi: { id: "Transaksi", en: "Transactions" },
  Batal: { id: "Batal", en: "Cancelled" },
  "Selisih Kas": { id: "Selisih Kas", en: "Cash Difference" },
  "Shift berhasil ditutup.": { id: "Shift berhasil ditutup.", en: "Shift closed successfully." },
  "Gagal memuat shift": { id: "Gagal memuat shift", en: "Failed to load shifts" },
  "Gagal menutup shift": { id: "Gagal menutup shift", en: "Failed to close shift" },
};

function readLanguage(): AppLanguage {
  if (typeof window === "undefined") return "id";
  return window.localStorage.getItem(storageKey) === "en" ? "en" : "id";
}

export function setAppLanguage(language: AppLanguage) {
  window.localStorage.setItem(storageKey, language);
  window.dispatchEvent(new CustomEvent(eventName, { detail: language }));
}

export function translate(text: string | undefined, language: AppLanguage) {
  if (!text) return text;
  return dictionary[text]?.[language] ?? text;
}

export function useAppLanguage() {
  const [language, setLanguageState] = useState<AppLanguage>("id");

  useEffect(() => {
    setLanguageState(readLanguage());

    function update(event: Event) {
      const next = (event as CustomEvent<AppLanguage>).detail || readLanguage();
      setLanguageState(next === "en" ? "en" : "id");
    }

    window.addEventListener(eventName, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(eventName, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return {
    language,
    setLanguage: setAppLanguage,
    t: (text: string | undefined) => translate(text, language) ?? "",
  };
}
