import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getManualBatchLimit } from "@/lib/admin-data";
import {
  createBatchRunRequest,
  markBatchRunRequestFailed,
} from "@/lib/batch-run-log";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";

type PriceMarket = "ALL" | "KR" | "US";

function isPriceMarket(value: unknown): value is PriceMarket {
  return value === "ALL" || value === "KR" || value === "US";
}

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: {
    market?: unknown;
    limit?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const market = isPriceMarket(body.market) ? body.market : "ALL";
  const maxLimit = getManualBatchLimit();
  const limit = Number(body.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    return NextResponse.json(
      { error: `limit must be an integer between 1 and ${maxLimit}` },
      { status: 400 }
    );
  }

  const requestId = randomUUID();
  await createBatchRunRequest({
    id: requestId,
    jobName: "update_metric_prices",
    market,
    message: `manual price dispatch requested market=${market} limit=${limit}`,
  });

  const result = await dispatchStockBatchWorkflow({
    mode: "metric_prices",
    limit: String(limit),
    requestId,
    priceMarket: market,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        message: "Price workflow dispatched",
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
