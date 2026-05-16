import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getManualBatchLimit } from "@/lib/admin-data";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";

type Market = "KR" | "US";
type Selection = "missing" | "existing";

function isMarket(value: unknown): value is Market {
  return value === "KR" || value === "US";
}

function isSelection(value: unknown): value is Selection {
  return value === "missing" || value === "existing";
}

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body: { market?: unknown; selection?: unknown; limit?: unknown };
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
      { error: "selection must be missing or existing" },
      { status: 400 }
    );
  }

  const maxLimit = getManualBatchLimit();
  const limit = Number(body.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    return NextResponse.json(
      { error: `limit must be an integer between 1 and ${maxLimit}` },
      { status: 400 }
    );
  }

  const mode = body.market.toLowerCase() as "kr" | "us";

  const result = await dispatchStockBatchWorkflow({
    mode,
    limit: String(limit),
    selection: body.selection,
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
      },
      { status: 202 }
    );
  }

  return NextResponse.json(
    {
      error: result.error,
      status: result.status,
      details: result.details,
    },
    { status: result.status === 503 ? 503 : 502 }
  );
}
