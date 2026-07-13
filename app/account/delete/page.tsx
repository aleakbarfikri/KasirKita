import { DeleteAccountForm } from "@/components/account/delete-account-form";

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-12 text-[#0f172a]">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-red-700">Pengaturan Akun</p>
        <h1 className="mt-2 text-3xl font-black">Hapus akun KasirKita</h1>
        <p className="mb-6 mt-3 text-[#59677a]">Anda dapat memulai penghapusan akun langsung dari aplikasi.</p>
        <DeleteAccountForm />
      </div>
    </main>
  );
}
