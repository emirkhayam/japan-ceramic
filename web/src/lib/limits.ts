import { prisma } from '@/lib/db';

export const DAILY_VISUALIZATION_LIMIT = 5;

export async function remainingDailyGenerations(
  userId: string,
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === 'admin') return Number.MAX_SAFE_INTEGER;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.visualizationLog.count({
    where: { userId, createdAt: { gte: dayStart } },
  });
  return Math.max(0, DAILY_VISUALIZATION_LIMIT - todayCount);
}

export async function checkDailyLimit(userId: string): Promise<string | null> {
  const remaining = await remainingDailyGenerations(userId);
  return remaining === 0
    ? `Дневной лимит визуализаций исчерпан (${DAILY_VISUALIZATION_LIMIT} в день). Попробуйте завтра.`
    : null;
}

export async function remainingMonthlyBudget(): Promise<number | null> {
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
  return Math.max(0, budget - monthCount);
}

export async function checkMonthlyBudget(): Promise<string | null> {
  const remaining = await remainingMonthlyBudget();
  return remaining === 0
    ? 'Месячный лимит AI-генераций исчерпан. Обратитесь к администратору.'
    : null;
}
