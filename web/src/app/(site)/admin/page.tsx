import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";

export default async function AdminDashboard() {
  await requireAdmin();

  const [productCount, categoryCount, userCount, newLeadCount, recentLeads, popularProducts, recentUsers] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count({ where: { role: "designer" } }),
    prisma.contactLead.count({ where: { isRead: false } }),
    prisma.contactLead.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.product.findMany({
      orderBy: { favorites: { _count: "desc" } },
      take: 5,
      include: { _count: { select: { favorites: true } }, images: { take: 1, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, where: { role: "designer" } }),
  ]);

  const stats = [
    { label: "Товаров", value: productCount, href: "/admin/products" },
    { label: "Категорий", value: categoryCount, href: "/admin/categories" },
    { label: "Дизайнеров", value: userCount, href: "/admin/users" },
    { label: "Новых заявок", value: newLeadCount, href: "/admin/leads" },
  ];

  return (
    <div className="pb-12 max-w-[960px]">
        <div className="mb-10">
          <h2 className="text-[clamp(26px,3vw,36px)] font-extralight tracking-tight">
            Дашборд
          </h2>
          <p className="text-[13px] text-[var(--ink-mute)] mt-1">Обзор данных сайта</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="group px-5 py-5 bg-[rgba(255,255,255,.02)] border border-[var(--line)] rounded-lg hover:border-[var(--line-2)] hover:bg-[rgba(255,255,255,.04)] transition-all duration-200 cursor-pointer"
            >
              <div className="tabular-nums text-[32px] font-medium leading-none tracking-tight">
                {s.value}
              </div>
              <div className="text-[11px] text-[var(--ink-mute)] mt-2 tracking-[.06em] uppercase font-medium">
                {s.label}
              </div>
            </Link>
          ))}
        </div>

        {/* Quick links */}
        <div className="text-[10px] font-medium tracking-[.3em] uppercase text-[var(--ink-faint)] mb-3">
          Разделы
        </div>
        <div className="grid md:grid-cols-2 gap-2.5">
          {[
            { href: "/admin/products", title: "Товары", desc: "Добавить, изменить, удалить" },
            { href: "/admin/categories", title: "Категории", desc: "Управление категориями" },
            { href: "/admin/users", title: "Пользователи", desc: "Дизайнеры и администраторы" },
            { href: "/admin/leads", title: "Заявки", desc: "Обращения клиентов с сайта" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex justify-between items-center px-5 py-4 border border-[var(--line)] rounded-lg hover:bg-[rgba(255,255,255,.03)] hover:border-[var(--line-2)] transition-all duration-200 cursor-pointer"
            >
              <div>
                <h3 className="text-[15px] font-normal mb-0.5">{item.title}</h3>
                <p className="text-[12px] text-[var(--ink-faint)]">{item.desc}</p>
              </div>
              <svg className="text-[var(--ink-faint)] group-hover:translate-x-1 group-hover:text-[var(--ink-mute)] transition-all duration-200" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </Link>
          ))}
        </div>

        {/* Recent Leads */}
        <div className="mt-10">
          <div className="text-[10px] font-medium tracking-[.3em] uppercase text-[var(--ink-faint)] mb-3">
            Последние заявки
          </div>
          <div className="border border-[var(--line)] rounded-lg overflow-hidden">
            {recentLeads.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-[var(--ink-mute)]">Нет заявок</div>
            ) : (
              recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href="/admin/leads"
                  className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] last:border-0 hover:bg-[rgba(255,255,255,.03)] transition-colors duration-150"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {!lead.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    )}
                    <span className="text-[13px] text-[var(--ink)] truncate">{lead.name}</span>
                    {lead.phone && (
                      <span className="text-[12px] text-[var(--ink-mute)] shrink-0">{lead.phone}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--ink-faint)] shrink-0 ml-3 tabular-nums">
                    {new Date(lead.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Popular Products */}
        <div className="mt-10">
          <div className="text-[10px] font-medium tracking-[.3em] uppercase text-[var(--ink-faint)] mb-3">
            Популярные товары
          </div>
          <div className="border border-[var(--line)] rounded-lg overflow-hidden">
            {popularProducts.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-[var(--ink-mute)]">Нет товаров</div>
            ) : (
              popularProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/admin/products/${product.id}`}
                  className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] last:border-0 hover:bg-[rgba(255,255,255,.03)] transition-colors duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {product.images[0] ? (
                      <img
                        src={product.images[0].imageUrl}
                        alt={product.name}
                        className="w-8 h-8 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[var(--line)] shrink-0" />
                    )}
                    <span className="text-[13px] text-[var(--ink)] truncate">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3 text-[var(--ink-mute)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--ink-faint)]">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <span className="text-[12px] tabular-nums font-medium">{product._count.favorites}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="mt-10">
          <div className="text-[10px] font-medium tracking-[.3em] uppercase text-[var(--ink-faint)] mb-3">
            Новые пользователи
          </div>
          <div className="border border-[var(--line)] rounded-lg overflow-hidden">
            {recentUsers.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-[var(--ink-mute)]">Нет пользователей</div>
            ) : (
              recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] last:border-0"
                >
                  <div className="min-w-0">
                    <span className="text-[13px] text-[var(--ink)] truncate block">{user.fullName}</span>
                    <span className="text-[11px] text-[var(--ink-faint)]">{user.company || "Дизайнер"}</span>
                  </div>
                  <span className="text-[11px] text-[var(--ink-faint)] shrink-0 ml-3 tabular-nums">
                    {new Date(user.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
    </div>
  );
}
