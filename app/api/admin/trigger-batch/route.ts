import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getManualBatchLimit, getWorkflowConfig } from "@/lib/admin-data";

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

  const workflow = getWorkflowConfig();
  if (!workflow.token) {
    return NextResponse.json(
      {
        error:
          "GITHUB_ACTIONS_TOKEN is not configured in the deployment environment.",
      },
      { status: 503 }
    );
  }

  const mode = body.market.toLowerCase();
  const dispatchUrl = `https://api.github.com/repos/${workflow.repository}/actions/workflows/${workflow.workflowId}/dispatches`;
  const dispatchBody = {
    ref: workflow.ref,
    inputs: {
      mode,
      limit: String(limit),
      selection: body.selection,
      shard_index: "0",
      shard_count: "1",
      codes: "",
      dry_run: "false",
    },
  };

  try {
    const githubResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${workflow.token}`,
        "Content-Type": "application/json",
        "User-Agent": "stock-next-admin",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(dispatchBody),
    });

    if (!githubResponse.ok) {
      const details = await githubResponse.text();
      return NextResponse.json(
        {
          error: "Failed to dispatch GitHub Actions workflow",
          status: githubResponse.status,
          details,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Batch workflow dispatched",
        repository: workflow.repository,
        workflowId: workflow.workflowId,
        ref: workflow.ref,
        inputs: dispatchBody.inputs,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("GitHub workflow dispatch error:", error);
    return NextResponse.json(
      { error: "GitHub workflow dispatch request failed" },
      { status: 502 }
    );
  }
}
