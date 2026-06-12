import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ProductCardPdf } from "@/lib/product-card-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Карта продукта доступна только авторизованным (любой залогиненный аккаунт).
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { category: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  if (!product) return new Response("Not found", { status: 404 });

  const element = createElement(ProductCardPdf, { product }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);

  // Имя файла с кириллицей — через filename* (RFC 5987) + ASCII-fallback.
  const safe = `product-card-${product.slug}`.replace(/[^a-z0-9-]/gi, "-");
  const utf8 = encodeURIComponent(`Карта продукта — ${product.name}.pdf`);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}.pdf"; filename*=UTF-8''${utf8}`,
      // Роут защищён сессией — нельзя кэшировать публично на CDN, иначе копия
      // утечёт анонимному пользователю. Держим ответ приватным.
      "Cache-Control": "private, no-store",
    },
  });
}
