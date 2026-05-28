import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "admin") redirect("/auth/login");
  return user;
}
