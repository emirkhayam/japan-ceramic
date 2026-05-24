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
        <div className="mb-10">
          <Link href="/admin" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors">
            ← Админ-панель
          </Link>
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5 mt-4">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Заявки с сайта
          </div>
          <h2 className="text-[clamp(32px,3.6vw,48px)] font-extralight">
            Заявки{" "}
            <span className="text-[var(--ink-mute)] text-2xl">
              {leads.length} всего · {leads.filter((l) => !l.isRead).length} новых
            </span>
          </h2>
        </div>

        <LeadsTable leads={leads} />
    </div>
  );
}
