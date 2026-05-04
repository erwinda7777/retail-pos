import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();
router.use(requireAuth);

const schema = z.object({ body: z.object({ name: z.string().min(2) }) });

router.get("/", asyncHandler(async (_req, res) => {
  const data = await prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  res.json(data);
}));

router.post("/", requireRole("ADMIN"), validate(schema), asyncHandler(async (req, res) => {
  const category = await prisma.category.create({ data: req.validated.body });
  res.status(201).json(category);
}));

router.put("/:id", requireRole("ADMIN"), validate(schema.extend({ params: z.object({ id: z.string() }) })), asyncHandler(async (req, res) => {
  const category = await prisma.category.update({ where: { id: req.validated.params.id }, data: req.validated.body });
  res.json(category);
}));

router.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

export default router;
