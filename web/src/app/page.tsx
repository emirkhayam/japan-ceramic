import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSiteSettings, telHref, waHref, tgHref, resolveMapEmbed } from "@/lib/settings";
import LandingContent from "@/components/landing/LandingContent";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function LandingPage() {
  const user = await getSession();
  const s = await getSiteSettings();
  const showrooms = [
    {
      name: s.showroomName || "Шоурум",
      address: s.address,
      hours: s.hours,
      mapLink: s.mapLink,
      mapEmbedUrl: resolveMapEmbed(s.mapEmbedUrl, s.mapLink),
    },
    // Второй шоурум — только если задан адрес.
    ...(s.address2
      ? [{
          name: s.showroomName2 || "Шоурум",
          address: s.address2,
          hours: s.hours,
          mapLink: s.mapLink2,
          mapEmbedUrl: resolveMapEmbed(null, s.mapLink2),
        }]
      : []),
  ];
  const contacts = {
    phone: s.phone,
    phoneHref: telHref(s.phone) ?? null,
    email: s.email,
    telegram: tgHref(s.telegram) ?? null,
    whatsapp: waHref(s.whatsapp) ?? null,
    showrooms,
  };

  // Карточки категорий для 3D-блока «Вдохновение в каждой категории».
  // Тексты/нумерация — маркетинговые (фикс), фото — реальное из БД с Unsplash-фолбэком.
  const CAT_DEFS = [
    { slug: "keramogranit", title: "Керамогранит", desc: "Крупноформатные решения для стен и полов", idx: "01" },
    { slug: "clinker", title: "Клинкер", desc: "Прочность, фактура и архитектурный характер", idx: "02" },
    { slug: "mosaic", title: "Мозаика", desc: "Детали, которые создают уникальный стиль", idx: "03" },
  ];
  const FALLBACK_IMG: Record<string, string> = {
    keramogranit: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?q=80&w=1100&auto=format&fit=crop",
    clinker: "https://images.unsplash.com/photo-1625008668243-e10fa6121030?q=80&w=1100&auto=format&fit=crop",
    mosaic: "https://images.unsplash.com/photo-1703867110039-dc2ad34be121?q=80&w=1100&auto=format&fit=crop",
  };
  // Закреплённые (курируемые) изображения категорий — приоритетнее фото из БД.
  const PINNED_IMG: Record<string, string> = {
    keramogranit: "https://hhrvuxttpurfclubunvp.supabase.co/storage/v1/object/public/uploads/products/opt-1780483050101-81ofyo.webp",
    clinker: "/categories/clinker.webp",
    mosaic: "/categories/mosaic.webp",
  };
  const catRows = await prisma.category.findMany({
    where: { slug: { in: CAT_DEFS.map((c) => c.slug) } },
    include: {
      products: {
        where: { isActive: true, images: { some: {} } },
        orderBy: [{ isPopular: "desc" }, { isNew: "desc" }, { createdAt: "desc" }],
        take: 1,
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
  });
  const categories = CAT_DEFS.map((c, i) => {
    const row = catRows.find((r) => r.slug === c.slug);
    return { ...c, i, img: PINNED_IMG[c.slug] || row?.products[0]?.images[0]?.imageUrl || FALLBACK_IMG[c.slug] };
  });

  return (
    <>
      <Header transparent />
      <main>
        <LandingContent
          user={user ? { fullName: user.fullName, role: user.role } : null}
          categories={categories}
          contacts={contacts}
        />
      </main>
      <Footer />
    </>
  );
}
