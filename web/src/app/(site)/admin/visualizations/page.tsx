import { prisma } from "@/lib/db";
import AiBudgetEditor from "./AiBudgetEditor";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("ru-RU");
}

export default async function AdminVisualizationsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allAgg, monthAgg, perUser, settings] = await Promise.all([
    prisma.visualizationLog.aggregate({ _count: { _all: true }, _sum: { totalTokens: true } }),
    prisma.visualizationLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { totalTokens: true },
    }),
    prisma.visualizationLog.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _sum: { totalTokens: true },
      _max: { createdAt: true },
    }),
    prisma.siteSettings.findUnique({ where: { id: "default" }, select: { aiTokenBudget: true } }),
  ]);

  const totalCount = allAgg._count._all;
  const totalTokens = allAgg._sum.totalTokens ?? 0;
  const monthCount = monthAgg._count._all;
  const monthTokens = monthAgg._sum.totalTokens ?? 0;
  const budget = settings?.aiTokenBudget ?? null;
  const remaining = budget != null ? Math.max(0, budget - monthTokens) : null;
  const usedPct = budget && budget > 0 ? Math.min(100, Math.round((monthTokens / budget) * 100)) : 0;

  // Имена пользователей для таблицы.
  const userIds = perUser.map((r) => r.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true, role: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = perUser
    .map((r) => ({
      user: userMap.get(r.userId),
      count: r._count._all,
      tokens: r._sum.totalTokens ?? 0,
      last: r._max.createdAt,
    }))
    .sort((a, b) => b.count - a.count);

  const monthLabel = now.toLocaleString("ru-RU", { month: "long", year: "numeric" });

  const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="px-5 py-5 bg-[var(--surface-1)] border border-[var(--line)] rounded-lg">
      <div className="text-[11px] tracking-[.06em] uppercase text-[var(--ink-mute)] mb-2">{label}</div>
      <div className="tabular-nums text-[28px] font-light leading-none">{value}</div>
      {sub && <div className="text-[12px] text-[var(--ink-faint)] mt-2">{sub}</div>}
    </div>
  );

  return (
    <div className="pb-12 max-w-[1000px]">
      <div className="mb-8">
        <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight">AI-визуализации</h2>
        <p className="text-[13px] text-[var(--ink-mute)] mt-1.5">
          Использование AI-визуализатора по пользователям и расход токенов.
        </p>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Всего визуализаций" value={fmt(totalCount)} />
        <Stat label={`За ${monthLabel}`} value={fmt(monthCount)} sub="визуализаций" />
        <Stat label="Токенов всего" value={fmt(totalTokens)} />
        <Stat label="Токенов за месяц" value={fmt(monthTokens)} />
      </div>

      {/* Бюджет токенов */}
      <div className="border border-[var(--line)] rounded-lg p-6 mb-6">
        <h3 className="text-[15px] font-medium mb-1">Лимит и остаток токенов</h3>
        <p className="text-[13px] text-[var(--ink-mute)] mb-5">
          Google не отдаёт остаток баланса по API, поэтому «осталось» считается от заданного вами месячного лимита.
        </p>

        {budget != null ? (
          <div className="mb-5">
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-[var(--ink-soft)]">
                Израсходовано за {monthLabel}: <span className="tabular-nums text-[var(--ink)]">{fmt(monthTokens)}</span> из {fmt(budget)}
              </span>
              <span className="tabular-nums text-[var(--color-gold-400)]">осталось {fmt(remaining ?? 0)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usedPct >= 90 ? "bg-[var(--danger)]" : "bg-[var(--color-gold-500)]"}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            {usedPct >= 90 && (
              <p className="text-[12px] text-[var(--danger)] mt-2">Лимит почти исчерпан — пополните квоту в Google (см. ниже).</p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-faint)] mb-5">Лимит не задан — задайте, чтобы видеть остаток.</p>
        )}

        <AiBudgetEditor initial={budget} />
      </div>

      {/* Как пополнять */}
      <details className="border border-[var(--line)] rounded-lg p-6 mb-8 group">
        <summary className="text-[15px] font-medium cursor-pointer list-none flex items-center justify-between">
          Как пополнить токены / увеличить лимит
          <span className="text-[var(--ink-faint)] text-[12px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="text-[13.5px] text-[var(--ink-soft)] leading-[1.7] mt-4 space-y-3">
          <p>
            Токены для AI-визуализации — это квота <strong>Google Gemini</strong> (модель Gemini Image). Пополнение
            происходит не в этой админке, а на стороне Google:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Откройте <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-[var(--color-gold-400)] hover:underline">Google AI Studio → API keys</a> того аккаунта, чей ключ указан в <code className="text-[var(--ink)]">GOOGLE_API_KEY</code>.</li>
            <li>Подключите проект к биллингу в <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener" className="text-[var(--color-gold-400)] hover:underline">Google Cloud Console → Billing</a> — это снимает ограничения бесплатного tier и поднимает лимиты.</li>
            <li>Текущие лимиты и фактический расход смотрите в <a href="https://console.cloud.google.com/apis/dashboard" target="_blank" rel="noopener" className="text-[var(--color-gold-400)] hover:underline">APIs &amp; Services → Quotas</a>.</li>
            <li>После изменения квот обновите при необходимости месячный лимит выше — он влияет только на отображение «остатка» здесь.</li>
          </ol>
          <p className="text-[12px] text-[var(--ink-faint)]">
            Бесплатный tier Gemini имеет суточные/минутные лимиты запросов. При их превышении визуализатор вернёт ошибку — это сигнал поднять квоту.
          </p>
        </div>
      </details>

      {/* По пользователям */}
      <h3 className="text-[15px] font-medium mb-4">По пользователям</h3>
      {rows.length === 0 ? (
        <div className="border border-dashed border-[var(--line)] rounded-lg py-12 text-center text-[var(--ink-mute)] text-[13px]">
          Пока никто не делал визуализаций.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="text-left text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] font-medium border-b border-[var(--line-2)]">
                <th className="py-3">Пользователь</th>
                <th className="py-3">Email</th>
                <th className="py-3 text-right">Визуализаций</th>
                <th className="py-3 text-right">Токенов</th>
                <th className="py-3">Последняя</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[var(--line)] hover:bg-[var(--surface-1)] transition-colors">
                  <td className="py-3 text-sm">{r.user?.fullName ?? "— удалён —"}</td>
                  <td className="py-3 text-sm text-[var(--ink-soft)]">{r.user?.email ?? "—"}</td>
                  <td className="py-3 text-sm tabular-nums text-right">{fmt(r.count)}</td>
                  <td className="py-3 text-sm tabular-nums text-right text-[var(--ink-soft)]">{fmt(r.tokens)}</td>
                  <td className="py-3 text-[12px] text-[var(--ink-faint)]">
                    {r.last ? new Date(r.last).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
