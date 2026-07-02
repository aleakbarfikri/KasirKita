import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server/auth-guard";

export default async function HomePage() {
  const session = await getCurrentSession();
  const role = session?.user.role;

  if (role === "owner") {
    redirect("/owner");
  }

  if (role === "admin" || role === "cashier") {
    redirect("/admin");
  }

  redirect("/login");
}
