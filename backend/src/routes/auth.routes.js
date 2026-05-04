import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler, AppError } from "../utils/errors.js";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "STAFF"]).optional()
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

router.post("/register", validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.validated.body;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new AppError(409, "Email already exists");

  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: count === 0 ? "ADMIN" : role || "STAFF"
    },
    select: { id: true, name: true, email: true, role: true }
  });

  res.status(201).json({ user, token: signToken(user) });
}));

router.post("/login", validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new AppError(401, "Invalid credentials");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, "Invalid credentials");

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token: signToken(user)
  });
}));

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
