export const toNumber = (value) => Number(value || 0);

export function calcDiscount(subtotal, discountType, discountValue) {
  const value = Number(discountValue || 0);
  if (!discountType || value <= 0) return 0;
  if (discountType === "PERCENT") return Math.min(subtotal, subtotal * (value / 100));
  return Math.min(subtotal, value);
}
