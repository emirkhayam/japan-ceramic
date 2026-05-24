import { requireAdmin } from "@/lib/admin-guard";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <>
      {/* Скрываем публичное меню сайта только на страницах админки */}
      <style>{`header{display:none!important}main{padding-top:0!important}`}</style>
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-7 md:py-9 flex flex-col md:flex-row gap-6 md:gap-10">
        <AdminSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </>
  );
}
