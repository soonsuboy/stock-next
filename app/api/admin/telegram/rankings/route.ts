import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";

type Period = "day" | "week";
type Sentiment = "positive" | "negative";

interface StockMention {
  code?: unknown;
  country?: unknown;
  name?: unknown;
  reason?: unknown;
  sentiment?: unknown;
}

interface RankedStock {
  key: string;
  code: string | null;
  country: string | null;
  name: string;
  count: number;
  reasons: string[];
}

function parseJsonArray(value: unknown): StockMention[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function stockKey(item: StockMention) {
  const country = typeof item.country === "string" ? item.country : "";
  const code = typeof item.code === "string" ? item.code : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (country && code) return `${country}:${code}`;
  return name || "";
}

function addMention(
  target: Map<string, RankedStock>,
  item: StockMention,
  seen: Set<string>
) {
  const key = stockKey(item);
  if (!key || seen.has(key)) return;
  seen.add(key);

  const existing = target.get(key);
  const reason = typeof item.reason === "string" ? item.reason.trim() : "";
  if (existing) {
    existing.count += 1;
    if (reason && existing.reasons.length < 3) {
      existing.reasons.push(reason);
    }
    return;
  }

  target.set(key, {
    key,
    code: typeof item.code === "string" ? item.code : null,
    country: typeof item.country === "string" ? item.country : null,
    name:
      (typeof item.name === "string" && item.name.trim()) ||
      (typeof item.code === "string" ? item.code : key),
    count: 1,
    reasons: reason ? [reason] : [],
  });
}

function addMentions(
  target: Map<string, RankedStock>,
  rowKey: string,
  sentiment: Sentiment,
  directItems: StockMention[],
  mentionedItems: StockMention[]
) {
  const seen = new Set<string>();
  for (const item of directItems) {
    addMention(target, item, seen);
  }
  for (const item of mentionedItems) {
    if (item.sentiment !== sentiment) continue;
    addMention(target, item, seen);
  }

  if (seen.size === 0) return;
  for (const key of seen) {
    const ranked = target.get(key);
    if (ranked) {
      ranked.key = ranked.key || rowKey;
    }
  }
}

function rankedItems(source: Map<string, RankedStock>) {
  return Array.from(source.values())
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 20);
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const date = request.nextUrl.searchParams.get("date") || "";
  const periodParam = request.nextUrl.searchParams.get("period") || "day";
  const period: Period = periodParam === "week" ? "week" : "day";

  if (!isDate(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const startDate = period === "week" ? shiftDate(date, -6) : date;
  const endDate = date;

  const result = await db.execute({
    sql: `SELECT
            chat_id,
            summary_date,
            positive_stocks,
            negative_stocks,
            mentioned_stocks,
            status
          FROM telegram_daily_summaries
          WHERE summary_date BETWEEN ? AND ?
            AND status = 'success'
          ORDER BY summary_date DESC, chat_id`,
    args: [startDate, endDate],
  });

  const positive = new Map<string, RankedStock>();
  const negative = new Map<string, RankedStock>();

  for (const row of result.rows) {
    const rowKey = `${row.chat_id}:${row.summary_date}`;
    const mentioned = parseJsonArray(row.mentioned_stocks);
    addMentions(
      positive,
      rowKey,
      "positive",
      parseJsonArray(row.positive_stocks),
      mentioned
    );
    addMentions(
      negative,
      rowKey,
      "negative",
      parseJsonArray(row.negative_stocks),
      mentioned
    );
  }

  return NextResponse.json({
    date,
    period,
    startDate,
    endDate,
    summaryRows: result.rows.length,
    positive: rankedItems(positive),
    negative: rankedItems(negative),
  });
}
