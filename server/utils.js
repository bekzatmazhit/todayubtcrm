import { db } from "./db.js";

export function logAction(req, { action, entityType, entityId, entityName, details, userId, userName } = {}) {
  try {
    const ip = req?.ip || req?.headers?.["x-forwarded-for"] || req?.connection?.remoteAddress || "";
    db.prepare(
      "INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, entity_name, details, ip) VALUES (?,?,?,?,?,?,?,?)"
    ).run(userId || null, userName || null, action, entityType || null, entityId || null, entityName || null, details || null, ip);
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
}

export function generateLessonDates(cycle) {
  const dates = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 14);
  const end = new Date(today);
  end.setDate(today.getDate() + 56);

  let days = [];
  if (cycle === "\u041f\u0421\u041f" || cycle === "PSP") days = [1, 3, 5];
  else if (cycle === "\u0412\u0427\u0421" || cycle === "VChS") days = [2, 4, 6];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}
