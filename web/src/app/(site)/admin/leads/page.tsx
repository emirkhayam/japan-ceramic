import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { LeadsTable } from "./LeadsTable";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  await requireAdmin();

  const rows = await prisma.contactLead.findMany({ orderBy: { createdAt: "desc" } });
  const leads = rows.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    message: l.message,
    source: l.source,
    isRead: l.isRead,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="pb-12">
        <div className="mb-8">
          <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight">
            Заявки
            <span className="text-[var(--ink-faint)] text-lg ml-2 font-light">{leads.length}</span>
          </h2>
          <p className="text-[13px] text-[var(--ink-mute)] mt-1">
            {leads.filter((l) => !l.isRead).length} новых
          </p>
        </div>

        <LeadsTable leads={leads} />
    </div>
  );
}
