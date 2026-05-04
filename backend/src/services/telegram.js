import { env } from "../config/env.js";

export async function notifyNewOrder(order) {
  if (!env.telegramBotToken || !env.telegramChatId) return;

  const text = `Don hang moi ${order.code}\nTong tien: ${Number(order.total).toLocaleString("vi-VN")} VND`;
  await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.telegramChatId, text })
  }).catch(() => undefined);
}
