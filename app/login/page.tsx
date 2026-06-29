import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Suspense fallback={<div className="rounded-2xl bg-white p-6 font-semibold shadow">Memuat login...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
