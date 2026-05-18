export interface StockBatchDispatchInputs {
  mode:
    | "index_universe"
    | "kr"
    | "us"
    | "watchlist_prices"
    | "telegram_dialogs"
    | "telegram_collect"
    | "telegram_summarize";
  codes?: string;
  limit?: string;
  selection?: "all" | "missing" | "existing" | "incomplete";
  shardIndex?: string;
  shardCount?: string;
  requestId?: string;
  telegramDate?: string;
  telegramBackfill?: "true" | "false";
  dryRun?: "true" | "false";
}

export function getWorkflowConfig() {
  return {
    token: process.env.GITHUB_ACTIONS_TOKEN || process.env.GITHUB_PAT || "",
    repository:
      process.env.GITHUB_ACTIONS_REPOSITORY ||
      process.env.GITHUB_REPOSITORY ||
      "soonsuboy/stock-next",
    workflowId: process.env.GITHUB_ACTIONS_WORKFLOW || "stock-batch.yml",
    ref: process.env.GITHUB_ACTIONS_REF || "main",
  };
}

export async function dispatchStockBatchWorkflow(
  inputs: StockBatchDispatchInputs
) {
  const workflow = getWorkflowConfig();
  if (!workflow.token) {
    return {
      ok: false,
      status: 503,
      error:
        "GITHUB_ACTIONS_TOKEN is not configured in the deployment environment.",
      details: "",
      workflow,
    };
  }

  const dispatchUrl = `https://api.github.com/repos/${workflow.repository}/actions/workflows/${workflow.workflowId}/dispatches`;
  const dispatchInputs = {
    mode: inputs.mode,
    limit: inputs.limit || "",
    selection: inputs.selection || "all",
    shard_index: inputs.shardIndex || "0",
    shard_count: inputs.shardCount || "1",
    codes: inputs.codes || "",
    request_id: inputs.requestId || "",
    telegram_date: inputs.telegramDate || "",
    telegram_backfill: inputs.telegramBackfill || "false",
    dry_run: inputs.dryRun || "false",
  };

  try {
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${workflow.token}`,
        "Content-Type": "application/json",
        "User-Agent": "stock-next-admin",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: workflow.ref,
        inputs: dispatchInputs,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: "Failed to dispatch GitHub Actions workflow",
        details: await response.text(),
        workflow,
      };
    }

    return {
      ok: true,
      status: 202,
      error: "",
      details: "",
      workflow,
      inputs: dispatchInputs,
    };
  } catch (error) {
    console.error("GitHub workflow dispatch error:", error);
    return {
      ok: false,
      status: 502,
      error: "GitHub workflow dispatch request failed",
      details: "",
      workflow,
    };
  }
}
