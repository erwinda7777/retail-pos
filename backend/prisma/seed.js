import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("123456", 12),
      role: "ADMIN"
    }
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      name: "Nhan vien",
      email: "staff@example.com",
      passwordHash: await bcrypt.hash("123456", 12),
      role: "STAFF"
    }
  });

  const beverage = await prisma.category.upsert({
    where: { name: "Do uong" },
    update: {},
    create: { name: "Do uong" }
  });

  const grocery = await prisma.category.upsert({
    where: { name: "Tap hoa" },
    update: {},
    create: { name: "Tap hoa" }
  });

  await prisma.product.upsert({
    where: { sku: "CF-001" },
    update: {},
    create: {
      name: "Ca phe lon",
      sku: "CF-001",
      barcode: "893000000001",
      costPrice: 8000,
      salePrice: 12000,
      stock: 100,
      lowStockAlert: 10,
      categoryId: beverage.id
    }
  });

  await prisma.product.upsert({
    where: { sku: "TEA-001" },
    update: {},
    create: {
      name: "Tra xanh chai",
      sku: "TEA-001",
      barcode: "893000000002",
      costPrice: 6000,
      salePrice: 10000,
      stock: 80,
      lowStockAlert: 10,
      categoryId: beverage.id
    }
  });

  await prisma.product.upsert({
    where: { sku: "RICE-005" },
    update: {},
    create: {
      name: "Gao thom 5kg",
      sku: "RICE-005",
      barcode: "893000000003",
      costPrice: 85000,
      salePrice: 115000,
      stock: 25,
      lowStockAlert: 5,
      categoryId: grocery.id
    }
  });

  await prisma.customer.upsert({
    where: { phone: "0900000001" },
    update: {},
    create: {
      name: "Nguyen Van A",
      phone: "0900000001",
      email: "a@example.com",
      address: "Quan 1, TP.HCM"
    }
  });

  console.log({ admin: admin.email, staff: staff.email, password: "123456" });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
