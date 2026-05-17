import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminApi } from "@/lib/admin";
import { getManualBatchLimit } from "@/lib/admin-data";
import {
  createBatchRunRequest,
  markBatchRunRequestFailed,
} from "@/lib/batch-run-log";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";

type Market = "KR" | "US";
type Selection = "all" | "missing" | "existing" | "incomplete";

function isMarket(value: unknown): value is Market {
  return value === "KR" || value === "US";
}

function isSelection(value: unknown): value is Selection {
  return (
    value === "all" ||
    value === "missing" ||
    value === "existing" ||
    value === "incomplete"
  );
}

function normalizeCodes(value: unknown, market: Market) {
  if (typeof value !== "string") return "";
  return value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .map((item) => (market === "KR" ? item.padStart(6, "0") : item.replace(".", "-")))
    .join(",");
}

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: {
    market?: unknown;
    selection?: unknown;
    limit?: unknown;
    codes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isMarket(body.market)) {
    return NextResponse.json(
      { error: "market must be KR or US" },
      { status: 400 }
    );
  }

  if (!isSelection(body.selection)) {
    return NextResponse.json(
      { error: "selection must be all, missing, existing, or incomplete" },
      { status: 400 }
    );
  }

  const codes = normalizeCodes(body.codes, body.market);
  const maxLimit = getManualBatchLimit();
  const limit = Number(body.limit);
  if (!codes && (!Number.isInteger(limit) || limit < 1 || limit > maxLimit)) {
    return NextResponse.json(
      { error: `limit must be an integer between 1 and ${maxLimit}` },
      { status: 400 }
    );
  }

  const mode = body.market.toLowerCase() as "kr" | "us";
  const requestId = randomUUID();
  await createBatchRunRequest({
    id: requestId,
    jobName: "update_metrics",
    market: body.market,
    message: codes
      ? `manual dispatch requested codes=${codes}`
      : `manual dispatch requested selection=${body.selection} limit=${limit}`,
  });

  const result = await dispatchStockBatchWorkflow({
    mode,
    limit: codes ? "" : String(limit),
    selection: body.selection,
    codes,
    requestId,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        message: "Batch workflow dispatched",
        repository: result.workflow.repository,
        workflowId: result.workflow.workflowId,
        ref: result.workflow.ref,
        inputs: result.inputs,
        requestId,
      },
      { status: 202 }
    );
  }

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
