import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();
router.use(requireAuth);

const body = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  debt: z.coerce.number().min(0).optional()
});

function normalizeCustomer(data) {
  const normalized = { ...data };
  if ("phone" in normalized) normalized.phone = normalized.phone?.trim() || null;
  if ("email" in normalized) normalized.email = normalized.email?.trim() || null;
  if ("address" in normalized) normalized.address = normalized.address?.trim() || null;
  return normalized;
}

router.get("/", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "");
  const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {};
  const customers = await prisma.customer.findMany({ where, orderBy: { updatedAt: "desc" }, take: 100 });
  res.json(customers);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 20 } }
  });
  res.json(customer);
}));

router.post("/", validate(z.object({ body })), asyncHandler(async (req, res) => {
  const customer = await prisma.customer.create({ data: normalizeCustomer(req.validated.body) });
  res.status(201).json(customer);
}));

router.put("/:id", validate(z.object({ params: z.object({ id: z.string() }), body: body.partial() })), asyncHandler(async (req, res) => {
  const customer = await prisma.customer.update({ where: { id: req.validated.params.id }, data: normalizeCustomer(req.validated.body) });
  res.json(customer);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

export default router;
