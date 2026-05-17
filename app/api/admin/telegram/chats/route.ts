import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  const result = await db.execute(
    `SELECT chat_id, title, username, chat_type, enabled, last_message_id, updated_at
     FROM telegram_chats
     ORDER BY enabled DESC, title`
  );

  return NextResponse.json({
    chats: result.rows.map((row) => ({
      chatId: String(row.chat_id),
      title: String(row.title),
      username: typeof row.username === "string" ? row.username : null,
      chatType: typeof row.chat_type === "string" ? row.chat_type : null,
      enabled: Boolean(row.enabled),
      lastMessageId: Number(row.last_message_id || 0),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })),
  });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const body = (await request.json()) as { enabledChatIds?: unknown };
  const enabledChatIds = Array.isArray(body.enabledChatIds)
    ? body.enabledChatIds.map(String)
    : [];

  await db.execute("UPDATE telegram_chats SET enabled = 0");
  for (const chatId of enabledChatIds) {
    await db.execute({
      sql: "UPDATE telegram_chats SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?",
      args: [chatId],
    });
  }

  return GET();
}
