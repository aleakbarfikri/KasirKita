import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server/auth-guard";

function getRole(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  return (session?.user as { role?: "owner" | "admin" } | undefined)?.role;
}

export default async function OwnerProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  const role = getRole(session);

  if (!session?.user) {
    redirect("/login?next=/owner");
  }

  if (role !== "owner") {
    redirect(role === "admin" ? "/admin" : "/login?next=/owner");
  }

  return <>{children}</>;
}
