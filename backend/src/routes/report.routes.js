import dayjs from "dayjs";
import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/errors.js";
import { toNumber } from "../utils/money.js";

const router = Router();
router.use(requireAuth);

router.get("/summary", asyncHandler(async (_req, res) => {
  const todayStart = dayjs().startOf("day").toDate();
  const monthStart = dayjs().startOf("month").toDate();
  const [todayOrders, monthOrders, lowStock, customers] = await Promise.all([
    prisma.order.findMany({ where: { status: "COMPLETED", createdAt: { gte: todayStart } }, include: { items: true } }),
    prisma.order.findMany({ where: { status: "COMPLETED", createdAt: { gte: monthStart } }, include: { items: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.customer.count()
  ]);

  const calc = (orders) => orders.reduce((acc, order) => {
    acc.revenue += toNumber(order.total);
    acc.profit += order.items.reduce((sum, item) => sum + (toNumber(item.unitPrice) - toNumber(item.costPrice)) * item.quantity, 0) - toNumber(order.discountTotal);
    return acc;
  }, { revenue: 0, profit: 0, orders: orders.length });

  const lowStockProducts = await prisma.product.findMany({ where: { isActive: true }, take: 200 });
  res.json({
    today: calc(todayOrders),
    month: calc(monthOrders),
    products: lowStock,
    customers,
    lowStock: lowStockProducts.filter((p) => p.stock <= p.lowStockAlert).length
  });
}));

router.get("/sales", asyncHandler(async (req, res) => {
  const from = req.query.from ? dayjs(String(req.query.from)).startOf("day") : dayjs().subtract(30, "day");
  const to = req.query.to ? dayjs(String(req.query.to)).endOf("day") : dayjs().endOf("day");
  const orders = await prisma.order.findMany({
    where: { status: "COMPLETED", createdAt: { gte: from.toDate(), lte: to.toDate() } },
    include: { items: true },
    orderBy: { createdAt: "asc" }
  });

  const byDay = new Map();
  for (const order of orders) {
    const key = dayjs(order.createdAt).format("YYYY-MM-DD");
    const row = byDay.get(key) || { date: key, revenue: 0, profit: 0, orders: 0 };
    row.revenue += toNumber(order.total);
    row.profit += order.items.reduce((sum, item) => sum + (toNumber(item.unitPrice) - toNumber(item.costPrice)) * item.quantity, 0) - toNumber(order.discountTotal);
    row.orders += 1;
    byDay.set(key, row);
  }
  res.json([...byDay.values()]);
}));

router.get("/top-products", asyncHandler(async (_req, res) => {
  const items = await prisma.orderItem.groupBy({
    by: ["productId", "name", "sku"],
    where: { order: { status: "COMPLETED" } },
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10
  });
  res.json(items.map((i) => ({ productId: i.productId, name: i.name, sku: i.sku, quantity: i._sum.quantity, revenue: i._sum.total })));
}));

router.get("/sales.csv", asyncHandler(async (_req, res) => {
  const orders = await prisma.order.findMany({ where: { status: "COMPLETED" }, include: { customer: true }, orderBy: { createdAt: "desc" } });
  const rows = ["code,createdAt,customer,total,paymentMethod"];
  for (const order of orders) {
    rows.push([order.code, order.createdAt.toISOString(), order.customer?.name || "", order.total, order.paymentMethod].join(","));
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sales.csv");
  res.send(rows.join("\n"));
}));

export default router;
