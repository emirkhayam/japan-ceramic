import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AI-визуализация плитки",
  description:
    "Примерьте керамогранит и клинкер на фото вашего интерьера или фасада: пол, стена, фасад по зонам или область кистью — фотореалистичный результат за 30 секунд.",
  alternates: { canonical: "/visualize" },
};

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
