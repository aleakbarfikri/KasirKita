import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server/auth-guard";

function getRole(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  return (session?.user as { role?: "owner" | "admin" | "cashier" } | undefined)?.role;
}

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  const role = getRole(session);

  if (!session?.user) {
    redirect("/login?next=/admin");
  }

  if (role !== "admin" && role !== "cashier") {
    redirect(role === "owner" ? "/owner" : "/login?next=/admin");
  }

  return <>{children}</>;
}
