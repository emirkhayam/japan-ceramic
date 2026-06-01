import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const user = await getSession();
  // Не залогинен — на вход. Залогинен, но не админ (напр. дизайнер) — в свой кабинет, а не на логин.
  if (!user) redirect("/auth/login");
  if (user.role !== "admin") redirect("/cabinet");
  return user;
}
