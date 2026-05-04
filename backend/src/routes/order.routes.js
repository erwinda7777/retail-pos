import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { notifyNewOrder } from "../services/telegram.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { calcDiscount, toNumber } from "../utils/money.js";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  body: z.object({
    customerId: z.string().optional().nullable(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.coerce.number().int().positive()
    })).min(1),
    discountType: z.enum(["PERCENT", "AMOUNT"]).optional().nullable(),
    discountValue: z.coerce.number().min(0).optional().default(0),
    paidAmount: z.coerce.number().min(0),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
    note: z.string().optional().nullable()
  })
});

function orderCode() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `HD${ymd}${String(now.getTime()).slice(-6)}`;
}

router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      include: { customer: true, user: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.order.count()
  ]);
  res.json({ items, total, page, limit });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { customer: true, user: { select: { id: true, name: true } }, items: true }
  });
  res.json(order);
}));

router.post("/", validate(createSchema), asyncHandler(async (req, res) => {
  const body = req.validated.body;

  const order = await prisma.$transaction(async (tx) => {
    const ids = body.items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: ids }, isActive: true } });
    const map = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const orderItems = [];

    for (const item of body.items) {
      const product = map.get(item.productId);
      if (!product) throw new AppError(404, "Product not found");
      if (product.stock < item.quantity) throw new AppError(400, `${product.name} does not have enough stock`);

      const unitPrice = toNumber(product.salePrice);
      const total = unitPrice * item.quantity;
      subtotal += total;
      orderItems.push({
        product,
        data: {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPrice,
          costPrice: toNumber(product.costPrice),
          total
        }
      });
    }

    const discountTotal = calcDiscount(subtotal, body.discountType, body.discountValue);
    const total = subtotal - discountTotal;
    const paidAmount = Number(body.paidAmount);
    const changeAmount = Math.max(0, paidAmount - total);

    const created = await tx.order.create({
      data: {
        code: orderCode(),
        customerId: body.customerId || null,
        userId: req.user.id,
        subtotal,
        discountType: body.discountType || null,
        discountValue: body.discountValue || 0,
        discountTotal,
        total,
        paidAmount,
        changeAmount,
        paymentMethod: body.paymentMethod,
        note: body.note || null,
        items: { create: orderItems.map((i) => i.data) }
      },
      include: { items: true, customer: true, user: { select: { id: true, name: true } } }
    });

    for (const item of orderItems) {
      const beforeStock = item.product.stock;
      const afterStock = beforeStock - item.data.quantity;
      await tx.product.update({ where: { id: item.product.id }, data: { stock: afterStock } });
      await tx.stockMovement.create({
        data: {
          productId: item.product.id,
          type: "SALE",
          quantity: -item.data.quantity,
          beforeStock,
          afterStock,
          reference: created.code,
          reason: "Ban hang",
          createdBy: req.user.id
        }
      });
    }

    if (body.customerId && paidAmount < total) {
      await tx.customer.update({ where: { id: body.customerId }, data: { debt: { increment: total - paidAmount } } });
    }

    return created;
  });

  notifyNewOrder(order);
  res.status(201).json(order);
}));

router.patch("/:id/cancel", asyncHandler(async (req, res) => {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!current) throw new AppError(404, "Order not found");
    if (current.status === "CANCELLED") return current;

    for (const item of current.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      const beforeStock = product.stock;
      const afterStock = beforeStock + item.quantity;
      await tx.product.update({ where: { id: item.productId }, data: { stock: afterStock } });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "ADJUSTMENT",
          quantity: item.quantity,
          beforeStock,
          afterStock,
          reference: current.code,
          reason: "Huy don hang",
          createdBy: req.user.id
        }
      });
    }

    return tx.order.update({ where: { id: req.params.id }, data: { status: "CANCELLED" }, include: { items: true } });
  });
  res.json(order);
}));

router.get("/:id/receipt.pdf", asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { customer: true, user: { select: { name: true } }, items: true }
  });
  if (!order) throw new AppError(404, "Order not found");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${order.code}.pdf`);
  const doc = new PDFDocument({ size: [226, 600], margin: 12 });
  doc.pipe(res);
  doc.fontSize(12).text("HOA DON BAN HANG", { align: "center" });
  doc.fontSize(8).text(order.code, { align: "center" });
  doc.moveDown();
  order.items.forEach((item) => {
    doc.text(`${item.name} x${item.quantity}`);
    doc.text(`${Number(item.total).toLocaleString("vi-VN")} VND`, { align: "right" });
  });
  doc.moveDown();
  doc.text(`Tong: ${Number(order.total).toLocaleString("vi-VN")} VND`, { align: "right" });
  doc.text(`Thanh toan: ${order.paymentMethod}`);
  doc.text("Cam on quy khach!", { align: "center" });
  doc.end();
}));

export default router;
