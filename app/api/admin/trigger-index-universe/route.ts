import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminApi } from "@/lib/admin";
import {
  createBatchRunRequest,
  markBatchRunRequestFailed,
} from "@/lib/batch-run-log";
import { dispatchStockBatchWorkflow } from "@/lib/github-actions";

export async function POST() {
  const { response } = await requireAdminApi();
  if (response) return response;

  const requestId = randomUUID();
  await createBatchRunRequest({
    id: requestId,
    jobName: "index_universe_metrics",
    market: "ALL",
    message:
      "manual dispatch requested S&P500 and KOSPI200 index universe pre-collection",
  });

  const result = await dispatchStockBatchWorkflow({
    mode: "index_universe",
    selection: "missing",
    shardIndex: "0",
    shardCount: "1",
    requestId,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        message: "Index universe batch workflow dispatched",
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
