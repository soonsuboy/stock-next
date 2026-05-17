import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  const result = await db.execute(
    `WITH date_chats AS (
       SELECT
         m.date_key,
         m.chat_id,
         COUNT(*) AS message_count,
         MAX(m.message_date) AS last_message_at
       FROM telegram_messages m
       JOIN telegram_chats c
         ON c.chat_id = m.chat_id AND c.enabled = 1
       GROUP BY m.date_key, m.chat_id
     )
     SELECT
       dc.date_key,
       COUNT(DISTINCT dc.chat_id) AS chat_count,
       SUM(dc.message_count) AS message_count,
       MAX(dc.last_message_at) AS last_message_at,
       COUNT(s.summary_date) AS summary_count,
       SUM(CASE WHEN s.status = 'success' THEN 1 ELSE 0 END) AS success_count,
       SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
       MAX(s.updated_at) AS last_summary_at
     FROM date_chats dc
     LEFT JOIN telegram_daily_summaries s
       ON s.chat_id = dc.chat_id
      AND s.summary_date = dc.date_key
     GROUP BY dc.date_key
     ORDER BY dc.date_key DESC
     LIMIT 30`
  );

  const dates = result.rows.map((row) => {
    const chatCount = toNumber(row.chat_count);
    const summaryCount = toNumber(row.summary_count);
    return {
      date: String(row.date_key),
      chatCount,
      messageCount: toNumber(row.message_count),
      summaryCount,
      successCount: toNumber(row.success_count),
      failedCount: toNumber(row.failed_count),
      pendingCount: Math.max(0, chatCount - summaryCount),
      lastMessageAt: toStringOrNull(row.last_message_at),
      lastSummaryAt: toStringOrNull(row.last_summary_at),
    };
  });

  return NextResponse.json({ dates });
}
