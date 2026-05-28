import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "keramogranit" },
      update: {},
      create: { name: "Керамогранит", slug: "keramogranit", sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: "clinker" },
      update: {},
      create: { name: "Клинкер", slug: "clinker", sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: "mosaic" },
      update: {},
      create: { name: "Мозаика", slug: "mosaic", sortOrder: 3 },
    }),
  ]);

  const [keramogranit, clinker, mosaic] = categories;

  // Demo products
  const products = [
    // Керамогранит
    { name: "Alchemy Grey", slug: "alchemy-grey", categoryId: keramogranit.id, collection: "Alchemy", color: "Серый", dimensions: "600×1200×10mm", surface: "Матовая", price: 4200, image: "https://images.unsplash.com/photo-1640357897497-599b4fc84f51?q=80&w=1200&auto=format&fit=crop" },
    { name: "Alchemy Dark", slug: "alchemy-dark", categoryId: keramogranit.id, collection: "Alchemy", color: "Тёмный", dimensions: "600×1200×10mm", surface: "Матовая", price: 4500, image: "https://images.unsplash.com/photo-1615971677499-5467cbab01c0?q=80&w=1200&auto=format&fit=crop" },
    { name: "Alchemy Sand", slug: "alchemy-sand", categoryId: keramogranit.id, collection: "Alchemy", color: "Песочный", dimensions: "600×600×10mm", surface: "Структурная", price: 3800, image: "https://images.unsplash.com/photo-1615874959474-d609969a20ed?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kai Bianco", slug: "kai-bianco", categoryId: keramogranit.id, collection: "Kai", color: "Белый", dimensions: "600×1200×10mm", surface: "Полированная", price: 5200, image: "https://images.unsplash.com/photo-1721189739138-f83066630f99?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kai Nero", slug: "kai-nero", categoryId: keramogranit.id, collection: "Kai", color: "Чёрный", dimensions: "600×1200×10mm", surface: "Полированная", price: 5800, image: "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=1200&auto=format&fit=crop" },
    // Клинкер
    { name: "Hellas 3P", slug: "hellas-3p", categoryId: clinker.id, collection: "Hellas", color: "Бежевый", dimensions: "400×400×10mm", surface: "Структурная", price: 3200, image: "/tiles-custom/hellas3p_400x400-1.jpg" },
    { name: "Denver 4", slug: "denver-4", categoryId: clinker.id, collection: "Denver", color: "Серый", dimensions: "400×400×10mm", surface: "Структурная", price: 3100, image: "/tiles-custom/denver_4_1_400x400.jpg" },
    { name: "Mocca 3P", slug: "mocca-3p", categoryId: clinker.id, collection: "Mocca", color: "Коричневый", dimensions: "400×275×10mm", surface: "Структурная", price: 2950, image: "/tiles-custom/mocca_400x275_3p.jpg" },
    { name: "Trend 7P", slug: "trend-7p", categoryId: clinker.id, collection: "Trend", color: "Микс", dimensions: "400×400×10mm", surface: "Структурная", price: 3300, image: "/tiles-custom/trend_7p_400x400-1.jpg" },
    { name: "Hellas 3P Type 1", slug: "hellas-3p-type1", categoryId: clinker.id, collection: "Hellas", color: "Бежевый", dimensions: "400×400×10mm", surface: "Структурная", price: 3250, image: "/tiles-custom/hellas3p_type1_400x400-1.jpg" },
    // Мозаика
    { name: "Kumo Ash", slug: "kumo-ash", categoryId: mosaic.id, collection: "Kumo", color: "Пепельный", dimensions: "300×300×8mm", surface: "Матовая", price: 3600, image: "https://images.unsplash.com/photo-1701655987884-a26d8aa74076?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kumo Steel", slug: "kumo-steel", categoryId: mosaic.id, collection: "Kumo", color: "Стальной", dimensions: "300×300×8mm", surface: "Полированная", price: 4100, image: "https://images.unsplash.com/photo-1617791160505-6f00504e3519?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kumo Cloud", slug: "kumo-cloud", categoryId: mosaic.id, collection: "Kumo", color: "Облачный", dimensions: "300×300×8mm", surface: "Матовая", price: 3400, image: "https://images.unsplash.com/photo-1604014237800-1c9102c219da?q=80&w=1200&auto=format&fit=crop" },
  ];

  for (const p of products) {
    const { image, ...productData } = p;
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...productData,
        description: `Премиальный керамогранит ${p.name} из коллекции ${p.collection}. Идеально подходит для современных интерьеров.`,
      },
    });

    // Add image
    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id },
    });
    if (!existingImage) {
      await prisma.productImage.create({
        data: { productId: product.id, imageUrl: image, isPrimary: true, sortOrder: 0 },
      });
    }
  }

  // Admin user
  const adminHash = await bcryptjs.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@japanceramic.com" },
    update: {},
    create: {
      email: "admin@japanceramic.com",
      hashedPassword: adminHash,
      fullName: "Admin",
      role: "admin",
    },
  });

  console.log("Seed completed: 3 categories, 13 products, 1 admin user");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
