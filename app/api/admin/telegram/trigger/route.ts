import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  createBatchRunRequest,
  markBatchRunRequestFailed,
} from "@/lib/batch-run-log";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";

type TelegramMode = "telegram_dialogs" | "telegram_collect" | "telegram_summarize";

function isTelegramMode(value: unknown): value is TelegramMode {
  return (
    value === "telegram_dialogs" ||
    value === "telegram_collect" ||
    value === "telegram_summarize"
  );
}

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: { mode?: unknown; date?: unknown; backfill?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isTelegramMode(body.mode)) {
    return NextResponse.json(
      { error: "mode must be telegram_dialogs, telegram_collect, or telegram_summarize" },
      { status: 400 }
    );
  }

  const requestId = randomUUID();
  await createBatchRunRequest({
    id: requestId,
    jobName: "telegram_sync",
    market: "TELEGRAM",
    message: `telegram dispatch requested mode=${body.mode} date=${
      typeof body.date === "string" ? body.date : ""
    } backfill=${Boolean(
      body.backfill
    )}`,
  });

  const result = await dispatchStockBatchWorkflow({
    mode: body.mode,
    requestId,
    telegramDate: typeof body.date === "string" ? body.date : "",
    telegramBackfill: body.backfill === true ? "true" : "false",
  });

  if (!result.ok) {
    await markBatchRunRequestFailed(requestId, `${result.error}\n${result.details}`);
    return NextResponse.json(
      {
        error: result.error,
        status: result.status,
        details: result.details,
      },
      { status: result.status === 503 ? 503 : 502 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      requestId,
      inputs: result.inputs,
    },
    { status: 202 }
  );
}
