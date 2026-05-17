import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDiscussionAccessApi } from "@/lib/discussion-access";
import { isValidTelegramMediaToken } from "@/lib/telegram-media-token";

function parseInteger(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const { response } = await requireDiscussionAccessApi();
  if (response) return response;

  const chatId = request.nextUrl.searchParams.get("chatId") || "";
  const messageId = parseInteger(request.nextUrl.searchParams.get("messageId"));
  const mediaIndex = parseInteger(request.nextUrl.searchParams.get("mediaIndex"));
  const token = request.nextUrl.searchParams.get("token") || "";

  if (!chatId || messageId === null || mediaIndex === null || !token) {
    return NextResponse.json({ error: "Invalid media request" }, { status: 400 });
  }

  if (!isValidTelegramMediaToken(token, chatId, messageId, mediaIndex)) {
    return NextResponse.json({ error: "Invalid media token" }, { status: 403 });
  }

  try {
    const result = await db.execute({
      sql: `SELECT
              media.mime_type,
              media.file_name,
              media.size_bytes,
              media.data_base64
            FROM telegram_media media
            JOIN telegram_chats chat
              ON chat.chat_id = media.chat_id AND chat.enabled = 1
            WHERE media.chat_id = ?
              AND media.message_id = ?
              AND media.media_index = ?
            LIMIT 1`,
      args: [chatId, messageId, mediaIndex],
    });
    const row = result.rows[0];
    const dataBase64 =
      row && typeof row.data_base64 === "string" ? row.data_base64 : "";

    if (!row || !dataBase64) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const body = Buffer.from(dataBase64, "base64");
    const mimeType =
      typeof row.mime_type === "string" && row.mime_type.trim()
        ? row.mime_type
        : "application/octet-stream";

    return new Response(body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(body.length),
        "Cache-Control": "private, max-age=86400",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Telegram media fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    );
  }
}
