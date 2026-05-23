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
      where: { slug: "stone" },
      update: {},
      create: { name: "Камень", slug: "stone", sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: "concrete" },
      update: {},
      create: { name: "Бетон", slug: "concrete", sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: "marble" },
      update: {},
      create: { name: "Мрамор", slug: "marble", sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: "metal" },
      update: {},
      create: { name: "Металл", slug: "metal", sortOrder: 4 },
    }),
    prisma.category.upsert({
      where: { slug: "wood" },
      update: {},
      create: { name: "Дерево", slug: "wood", sortOrder: 5 },
    }),
  ]);

  const [stone, concrete, marble, metal, wood] = categories;

  // Demo products
  const products = [
    { name: "Alchemy Grey", slug: "alchemy-grey", categoryId: stone.id, collection: "Alchemy", color: "Серый", dimensions: "600×1200×10mm", surface: "Матовая", price: 4200, image: "https://images.unsplash.com/photo-1640357897497-599b4fc84f51?q=80&w=1200&auto=format&fit=crop" },
    { name: "Alchemy Dark", slug: "alchemy-dark", categoryId: stone.id, collection: "Alchemy", color: "Тёмный", dimensions: "600×1200×10mm", surface: "Матовая", price: 4500, image: "https://images.unsplash.com/photo-1615971677499-5467cbab01c0?q=80&w=1200&auto=format&fit=crop" },
    { name: "Alchemy Sand", slug: "alchemy-sand", categoryId: stone.id, collection: "Alchemy", color: "Песочный", dimensions: "600×600×10mm", surface: "Структурная", price: 3800, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kumo Ash", slug: "kumo-ash", categoryId: concrete.id, collection: "Kumo", color: "Пепельный", dimensions: "800×800×10mm", surface: "Матовая", price: 3600, image: "https://images.unsplash.com/photo-1701655987884-a26d8aa74076?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kumo Steel", slug: "kumo-steel", categoryId: concrete.id, collection: "Kumo", color: "Стальной", dimensions: "600×1200×10mm", surface: "Полированная", price: 4100, image: "https://images.unsplash.com/photo-1617791160505-6f00504e3519?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kumo Cloud", slug: "kumo-cloud", categoryId: concrete.id, collection: "Kumo", color: "Облачный", dimensions: "600×600×10mm", surface: "Матовая", price: 3400, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kai Bianco", slug: "kai-bianco", categoryId: marble.id, collection: "Kai", color: "Белый", dimensions: "600×1200×10mm", surface: "Полированная", price: 5200, image: "https://images.unsplash.com/photo-1721189739138-f83066630f99?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kai Nero", slug: "kai-nero", categoryId: marble.id, collection: "Kai", color: "Чёрный", dimensions: "600×1200×10mm", surface: "Полированная", price: 5800, image: "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=1200&auto=format&fit=crop" },
    { name: "Kai Calacatta", slug: "kai-calacatta", categoryId: marble.id, collection: "Kai", color: "Калакатта", dimensions: "1200×1200×10mm", surface: "Глянцевая", price: 6500, image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop" },
    { name: "Yoru Bronze", slug: "yoru-bronze", categoryId: metal.id, collection: "Yoru", color: "Бронзовый", dimensions: "600×600×10mm", surface: "Структурная", price: 4800, image: "https://images.unsplash.com/photo-1506730447-7683abca8434?q=80&w=1200&auto=format&fit=crop" },
    { name: "Yoru Copper", slug: "yoru-copper", categoryId: metal.id, collection: "Yoru", color: "Медный", dimensions: "600×1200×10mm", surface: "Матовая", price: 5100, image: "https://images.unsplash.com/photo-1640357960494-9242650846d3?q=80&w=1200&auto=format&fit=crop" },
    { name: "Yoru Iron", slug: "yoru-iron", categoryId: metal.id, collection: "Yoru", color: "Железный", dimensions: "600×600×10mm", surface: "Структурная", price: 4600, image: "https://images.unsplash.com/photo-1698870157085-11632d2ddef8?q=80&w=1200&auto=format&fit=crop" },
    { name: "Sakura Oak", slug: "sakura-oak", categoryId: wood.id, collection: "Sakura", color: "Дуб", dimensions: "200×1200×10mm", surface: "Матовая", price: 3200, image: "https://images.unsplash.com/photo-1610659856580-323ec67011f9?q=80&w=1200&auto=format&fit=crop" },
    { name: "Sakura Walnut", slug: "sakura-walnut", categoryId: wood.id, collection: "Sakura", color: "Орех", dimensions: "200×1200×10mm", surface: "Матовая", price: 3500, image: "https://images.unsplash.com/photo-1622372738946-62e02505feb3?q=80&w=1200&auto=format&fit=crop" },
    { name: "Sakura Ash", slug: "sakura-ash", categoryId: wood.id, collection: "Sakura", color: "Ясень", dimensions: "200×1200×10mm", surface: "Структурная", price: 3300, image: "https://images.unsplash.com/photo-1683339888007-426ea270374f?q=80&w=1200&auto=format&fit=crop" },
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

  console.log("Seed completed: 5 categories, 15 products, 1 admin user");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
