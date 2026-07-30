import { prisma } from '@/lib/db';

export const DAILY_VISUALIZATION_LIMIT = 5;

export async function checkDailyLimit(userId: string): Promise<string | null> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.visualizationLog.count({
    where: { userId, createdAt: { gte: dayStart } },
  });
  return todayCount >= DAILY_VISUALIZATION_LIMIT
    ? `Дневной лимит визуализаций исчерпан (${DAILY_VISUALIZATION_LIMIT} в день). Попробуйте завтра.`
    : null;
}

export async function checkMonthlyBudget(): Promise<string | null> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 'default' },
    select: { aiTokenBudget: true },
  });
  const budget = settings?.aiTokenBudget;
  // Значения >1000 принадлежат старому токенному масштабу.
  if (budget == null || budget < 1 || budget > 1000) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = await prisma.visualizationLog.count({
    where: { createdAt: { gte: monthStart } },
  });
  return monthCount >= budget
    ? 'Месячный лимит AI-генераций исчерпан. Обратитесь к администратору.'
    : null;
}
