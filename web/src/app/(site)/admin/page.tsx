import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";

export default async function AdminDashboard() {
  await requireAdmin();

  const [productCount, categoryCount, userCount, newLeadCount] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count({ where: { role: "designer" } }),
    prisma.contactLead.count({ where: { isRead: false } }),
  ]);

  const stats = [
    { label: "Товаров", value: productCount, href: "/admin/products" },
    { label: "Категорий", value: categoryCount, href: "/admin/categories" },
    { label: "Дизайнеров", value: userCount, href: "/admin/users" },
    { label: "Новых заявок", value: newLeadCount, href: "/admin/leads" },
  ];

  return (
    <div className="pb-12">
        <div className="mb-12">
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Админ-панель
          </div>
          <h2 className="text-[clamp(32px,3.6vw,48px)] font-extralight">
            Japan Ceramic
          </h2>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="px-7 py-6 border border-[var(--line)] rounded-sm hover:border-[var(--line-2)] hover:bg-[rgba(255,255,255,.02)] transition-all"
            >
              <div className="font-[family-name:var(--font-cormorant)] text-4xl font-medium leading-none">
                {s.value}
              </div>
              <div className="text-[11px] text-[var(--ink-mute)] mt-1.5 tracking-[.08em] uppercase">
                {s.label}
              </div>
            </Link>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/admin/products"
            className="group flex justify-between items-center px-6 py-5 border border-[var(--line)] rounded-sm hover:bg-[rgba(255,255,255,.03)] hover:border-[var(--line-2)] transition-all"
          >
            <div>
              <h3 className="text-lg font-light mb-1">Товары</h3>
              <p className="text-[13px] text-[var(--ink-mute)]">Добавить, изменить, удалить</p>
            </div>
            <span className="text-[var(--ink-faint)] group-hover:translate-x-1 group-hover:text-[var(--ink)] transition-all">→</span>
          </Link>
          <Link
            href="/admin/categories"
            className="group flex justify-between items-center px-6 py-5 border border-[var(--line)] rounded-sm hover:bg-[rgba(255,255,255,.03)] hover:border-[var(--line-2)] transition-all"
          >
            <div>
              <h3 className="text-lg font-light mb-1">Категории</h3>
              <p className="text-[13px] text-[var(--ink-mute)]">Управление категориями</p>
            </div>
            <span className="text-[var(--ink-faint)] group-hover:translate-x-1 group-hover:text-[var(--ink)] transition-all">→</span>
          </Link>
          <Link
            href="/admin/users"
            className="group flex justify-between items-center px-6 py-5 border border-[var(--line)] rounded-sm hover:bg-[rgba(255,255,255,.03)] hover:border-[var(--line-2)] transition-all"
          >
            <div>
              <h3 className="text-lg font-light mb-1">Пользователи</h3>
              <p className="text-[13px] text-[var(--ink-mute)]">Дизайнеры и администраторы</p>
            </div>
            <span className="text-[var(--ink-faint)] group-hover:translate-x-1 group-hover:text-[var(--ink)] transition-all">→</span>
          </Link>
          <Link
            href="/admin/leads"
            className="group flex justify-between items-center px-6 py-5 border border-[var(--line)] rounded-sm hover:bg-[rgba(255,255,255,.03)] hover:border-[var(--line-2)] transition-all"
          >
            <div>
              <h3 className="text-lg font-light mb-1">Заявки</h3>
              <p className="text-[13px] text-[var(--ink-mute)]">Обращения клиентов с сайта</p>
            </div>
            <span className="text-[var(--ink-faint)] group-hover:translate-x-1 group-hover:text-[var(--ink)] transition-all">→</span>
          </Link>
        </div>
    </div>
  );
}
