import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function VisualizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login?from=/visualize");
  if (user.status !== "approved") redirect("/cabinet");
  return <>{children}</>;
}
