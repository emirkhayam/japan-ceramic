import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const pendingCount = await prisma.user.count({ where: { status: "pending" } });

  return (
    <>
      <style>{`header{display:none!important}main{padding-top:0!important}`}</style>
      <div className="min-h-screen flex flex-col md:flex-row">
        <div className="md:w-[260px] shrink-0 md:border-r md:border-[var(--line)] md:py-8 md:px-5 px-4 py-4">
          <AdminSidebar pendingCount={pendingCount} />
        </div>
        <div className="flex-1 min-w-0 px-6 md:px-10 py-6 md:py-8">{children}</div>
      </div>
    </>
  );
}
