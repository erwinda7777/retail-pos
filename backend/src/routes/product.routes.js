import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();
router.use(requireAuth);

const productBody = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  barcode: z.string().optional().nullable(),
  costPrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).optional(),
  lowStockAlert: z.coerce.number().int().min(0).optional(),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

function normalizeProduct(data) {
  const normalized = { ...data };
  if ("barcode" in normalized) normalized.barcode = normalized.barcode?.trim() || null;
  if ("categoryId" in normalized) normalized.categoryId = normalized.categoryId || null;
  return normalized;
}

router.get("/", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "");
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } }
        ]
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: { category: true }, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: "desc" } }),
    prisma.product.count({ where })
  ]);
  res.json({ items, total, page, limit });
}));

router.get("/low-stock", asyncHandler(async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { stock: "asc" }
  });
  res.json(products.filter((p) => p.stock <= p.lowStockAlert));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { category: true } });
  res.json(product);
}));

router.post("/", requireRole("ADMIN"), validate(z.object({ body: productBody })), asyncHandler(async (req, res) => {
  const product = await prisma.product.create({ data: normalizeProduct(req.validated.body) });
  res.status(201).json(product);
}));

router.put("/:id", requireRole("ADMIN"), validate(z.object({ params: z.object({ id: z.string() }), body: productBody.partial() })), asyncHandler(async (req, res) => {
  const product = await prisma.product.update({ where: { id: req.validated.params.id }, data: normalizeProduct(req.validated.body) });
  res.json(product);
}));

router.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).send();
}));

export default router;
