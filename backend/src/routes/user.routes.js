import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

router.get("/", asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(users);
}));

router.post("/", validate(z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "STAFF"])
  })
})), asyncHandler(async (req, res) => {
  const { password, ...data } = req.validated.body;
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
  res.status(201).json(user);
}));

router.patch("/:id", validate(z.object({
  params: z.object({ id: z.string() }),
  body: z.object({ name: z.string().min(2).optional(), role: z.enum(["ADMIN", "STAFF"]).optional(), isActive: z.boolean().optional() })
})), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.validated.params.id },
    data: req.validated.body,
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
  res.json(user);
}));

export default router;
