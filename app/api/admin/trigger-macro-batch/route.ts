import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
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
    jobName: "update_macro_indicators",
    market: "ALL",
    message: "manual macro indicator recollection requested",
  });

  const result = await dispatchStockBatchWorkflow({
    mode: "macro",
    requestId,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        message: "Macro indicator workflow dispatched",
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
