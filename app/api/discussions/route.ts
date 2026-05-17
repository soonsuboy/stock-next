import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTelegramMediaToken } from "@/lib/telegram-media-token";

function parseJsonArray(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const chatParam = request.nextUrl.searchParams.get("chatId") || "";
  const dateParam = request.nextUrl.searchParams.get("date") || "";

  try {
    const chatsResult = await db.execute(
      `SELECT chat_id, title, username, chat_type
       FROM telegram_chats
       WHERE enabled = 1
       ORDER BY title`
    );
    const chats = chatsResult.rows.map((row) => ({
      chatId: String(row.chat_id),
      title: String(row.title),
      username: typeof row.username === "string" ? row.username : null,
      chatType: typeof row.chat_type === "string" ? row.chat_type : null,
    }));

    const chatId = chatParam || chats[0]?.chatId || "";
    const datesResult = await db.execute({
      sql: `SELECT
              m.date_key,
              COUNT(*) AS message_count,
              MAX(s.summary) AS summary
            FROM telegram_messages m
            JOIN telegram_chats c
              ON c.chat_id = m.chat_id AND c.enabled = 1
            LEFT JOIN telegram_daily_summaries s
              ON s.chat_id = m.chat_id AND s.summary_date = m.date_key
            WHERE (? = '' OR m.chat_id = ?)
            GROUP BY m.date_key
            ORDER BY m.date_key DESC
            LIMIT 60`,
      args: [chatId, chatId],
    });
    const dates = datesResult.rows.map((row) => ({
      date: String(row.date_key),
      messageCount: Number(row.message_count || 0),
      summary: typeof row.summary === "string" ? row.summary : "",
    }));
    const selectedDate = dateParam || dates[0]?.date || "";

    const [messagesResult, summariesResult] = await Promise.all([
      db.execute({
        sql: `SELECT
                m.chat_id,
                m.message_id,
                m.message_date,
                m.hour_key,
                m.sender_name,
                m.text,
                m.has_media,
                media.mime_type,
                media.file_name,
                media.size_bytes,
                media.media_index,
                CASE
                  WHEN media.data_base64 IS NOT NULL AND media.data_base64 <> ''
                  THEN 1
                  ELSE 0
                END AS media_available
              FROM telegram_messages m
              JOIN telegram_chats c
                ON c.chat_id = m.chat_id AND c.enabled = 1
              LEFT JOIN telegram_media media
                ON media.chat_id = m.chat_id
               AND media.message_id = m.message_id
               AND media.media_index = 0
              WHERE m.date_key = ?
                AND (? = '' OR m.chat_id = ?)
              ORDER BY m.message_date, m.message_id
              LIMIT 1000`,
        args: [selectedDate, chatId, chatId],
      }),
      db.execute({
        sql: `SELECT
                s.chat_id,
                c.title,
                s.summary_date,
                s.summary,
                s.positive_stocks,
                s.negative_stocks,
                s.mentioned_stocks,
                s.status,
                s.error,
                s.updated_at
              FROM telegram_daily_summaries s
              JOIN telegram_chats c
                ON c.chat_id = s.chat_id
              WHERE s.summary_date = ?
                AND (? = '' OR s.chat_id = ?)
              ORDER BY c.title`,
        args: [selectedDate, chatId, chatId],
      }),
    ]);

    const messages = messagesResult.rows.map((row) => ({
      chatId: String(row.chat_id),
      messageId: Number(row.message_id),
      messageDate: String(row.message_date),
      hourKey: String(row.hour_key),
      senderName: typeof row.sender_name === "string" ? row.sender_name : "",
      text: typeof row.text === "string" ? row.text : "",
      hasMedia: Boolean(row.has_media),
      media:
        Number(row.media_available || 0) === 1
          ? {
              mimeType:
                typeof row.mime_type === "string" && row.mime_type
                  ? row.mime_type
                  : "image/jpeg",
              fileName: typeof row.file_name === "string" ? row.file_name : "",
              sizeBytes: Number(row.size_bytes || 0),
              mediaUrl: `/api/discussions/media?chatId=${encodeURIComponent(
                String(row.chat_id)
              )}&messageId=${encodeURIComponent(
                String(row.message_id)
              )}&mediaIndex=${encodeURIComponent(
                String(row.media_index || 0)
              )}&token=${createTelegramMediaToken(
                String(row.chat_id),
                String(row.message_id),
                String(row.media_index || 0)
              )}`,
            }
          : null,
    }));

    const summaries = summariesResult.rows.map((row) => ({
      chatId: String(row.chat_id),
      title: String(row.title),
      summaryDate: String(row.summary_date),
      summary: typeof row.summary === "string" ? row.summary : "",
      positiveStocks: parseJsonArray(row.positive_stocks),
      negativeStocks: parseJsonArray(row.negative_stocks),
      mentionedStocks: parseJsonArray(row.mentioned_stocks),
      status: typeof row.status === "string" ? row.status : "",
      error: typeof row.error === "string" ? row.error : "",
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    }));

    return NextResponse.json({
      chats,
      dates,
      selectedChatId: chatId,
      selectedDate,
      messages,
      summaries,
    });
  } catch (error) {
    console.error("Discussions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch discussions" },
      { status: 500 }
    );
  }
}
