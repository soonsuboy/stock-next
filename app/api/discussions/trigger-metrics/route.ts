import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  createBatchRunRequest,
  markBatchRunRequestFailed,
} from "@/lib/batch-run-log";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";

type Country = "KR" | "US";

function parseJsonArray(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isCountry(value: unknown): value is Country {
  return value === "KR" || value === "US";
}

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: { date?: unknown; chatId?: unknown; sentiment?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date : "";
  const chatId = typeof body.chatId === "string" ? body.chatId : "";
  const sentiment =
    body.sentiment === "positive" || body.sentiment === "negative"
      ? body.sentiment
      : "all";

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const summaries = await db.execute({
    sql: `SELECT positive_stocks, negative_stocks
          FROM telegram_daily_summaries
          WHERE summary_date = ?
            AND (? = '' OR chat_id = ?)`,
    args: [date, chatId, chatId],
  });

  const codesByCountry: Record<Country, Set<string>> = {
    KR: new Set(),
    US: new Set(),
  };

  for (const row of summaries.rows) {
    const source =
      sentiment === "positive"
        ? parseJsonArray(row.positive_stocks)
        : sentiment === "negative"
          ? parseJsonArray(row.negative_stocks)
          : [
              ...parseJsonArray(row.positive_stocks),
              ...parseJsonArray(row.negative_stocks),
            ];
    for (const item of source) {
      if (!item || typeof item !== "object") continue;
      const record = item as { code?: unknown; country?: unknown };
      if (typeof record.code === "string" && isCountry(record.country)) {
        codesByCountry[record.country].add(record.code);
      }
    }
  }

  const dispatched: Array<{ country: Country; count: number; requestId: string }> = [];

  for (const country of ["KR", "US"] as const) {
    const codes = Array.from(codesByCountry[country]);
    if (codes.length === 0) continue;

    const requestId = randomUUID();
    await createBatchRunRequest({
      id: requestId,
      jobName: "update_metrics",
      market: country,
      message: `telegram discussion metrics requested date=${date} sentiment=${sentiment}`,
    });

    const result = await dispatchStockBatchWorkflow({
      mode: country.toLowerCase() as "kr" | "us",
      codes: codes.join(","),
      selection: "all",
      requestId,
    });

    if (!result.ok) {
      await markBatchRunRequestFailed(requestId, `${result.error}\n${result.details}`);
      return NextResponse.json(
        {
          error: result.error,
          status: result.status,
          details: result.details,
          dispatched,
        },
        { status: result.status === 503 ? 503 : 502 }
      );
    }

    dispatched.push({ country, count: codes.length, requestId });
  }

  return NextResponse.json({ ok: true, dispatched }, { status: 202 });
}
