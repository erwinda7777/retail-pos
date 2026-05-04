import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler, AppError } from "../utils/errors.js";

const router = Router();
router.use(requireAuth);

const movementSchema = z.object({
  body: z.object({
    productId: z.string(),
    type: z.enum(["IMPORT", "EXPORT", "ADJUSTMENT"]),
    quantity: z.coerce.number().int().positive(),
    reason: z.string().optional().nullable(),
    reference: z.string().optional().nullable()
  })
});

router.get("/movements", asyncHandler(async (req, res) => {
  const movements = await prisma.stockMovement.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(req.query.limit || 100), 200)
  });
  res.json(movements);
}));

router.post("/movements", validate(movementSchema), asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const movement = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: body.productId } });
    if (!product) throw new AppError(404, "Product not found");

    const signedQuantity = body.type === "IMPORT" ? body.quantity : -body.quantity;
    const afterStock = product.stock + signedQuantity;
    if (afterStock < 0) throw new AppError(400, "Stock cannot be negative");

    await tx.product.update({ where: { id: product.id }, data: { stock: afterStock } });
    return tx.stockMovement.create({
      data: {
        productId: product.id,
        type: body.type,
        quantity: signedQuantity,
        beforeStock: product.stock,
        afterStock,
        reason: body.reason || null,
        reference: body.reference || null,
        createdBy: req.user.id
      },
      include: { product: true }
    });
  });
  res.status(201).json(movement);
}));

export default router;
