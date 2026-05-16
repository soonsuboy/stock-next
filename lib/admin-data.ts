import { db } from "@/lib/db";
import { getWorkflowConfig } from "@/lib/github-actions";

export interface BatchCoverage {
  country: string;
  companyCount: number;
  metricsCompanyCount: number;
  missingMetricsCount: number;
  latestSnapshot: string | null;
  metricsRowCount: number;
}

export interface BatchRun {
  id: string;
  jobName: string;
  market: string | null;
  shardIndex: number | null;
  shardCount: number | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  processed: number;
  succeeded: number;
  failed: number;
  errorSample: string | null;
}

export interface AdminBatchStatus {
  coverage: BatchCoverage[];
  recentRuns: BatchRun[];
  workflowDispatchConfigured: boolean;
  repository: string;
  workflowId: string;
  ref: string;
  maxManualLimit: number;
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

export function getManualBatchLimit() {
  const value = Number(process.env.ADMIN_BATCH_MAX_LIMIT || 500);
  if (!Number.isFinite(value) || value < 1) return 500;
  return Math.min(Math.floor(value), 1000);
}

export async function getAdminBatchStatus(): Promise<AdminBatchStatus> {
  const [coverageResult, runsResult] = await Promise.all([
    db.execute({
      sql: `WITH metric_companies AS (
              SELECT code, country
              FROM metrics_history
              GROUP BY code, country
            ),
            metric_summary AS (
              SELECT
                country,
                MAX(snapshot_date) AS latest_snapshot,
                COUNT(*) AS metrics_row_count
              FROM metrics_history
              GROUP BY country
            )
            SELECT
              c.country,
              COUNT(*) AS company_count,
              SUM(CASE WHEN mc.code IS NOT NULL THEN 1 ELSE 0 END) AS metrics_company_count,
              SUM(CASE WHEN mc.code IS NULL THEN 1 ELSE 0 END) AS missing_metrics_count,
              ms.latest_snapshot,
              COALESCE(ms.metrics_row_count, 0) AS metrics_row_count
            FROM companies c
            LEFT JOIN metric_companies mc
              ON c.code = mc.code AND c.country = mc.country
            LEFT JOIN metric_summary ms
              ON c.country = ms.country
            GROUP BY c.country
            ORDER BY c.country`,
    }),
    db.execute({
      sql: `SELECT
              id,
              job_name,
              market,
              shard_index,
              shard_count,
              status,
              started_at,
              completed_at,
              processed,
              succeeded,
              failed,
              error_sample
            FROM batch_runs
            ORDER BY COALESCE(started_at, completed_at) DESC
            LIMIT 20`,
    }),
  ]);

  const workflow = getWorkflowConfig();

  return {
    coverage: coverageResult.rows.map((row) => ({
      country: String(row.country),
      companyCount: toNumber(row.company_count),
      metricsCompanyCount: toNumber(row.metrics_company_count),
      missingMetricsCount: toNumber(row.missing_metrics_count),
      latestSnapshot: toStringOrNull(row.latest_snapshot),
      metricsRowCount: toNumber(row.metrics_row_count),
    })),
    recentRuns: runsResult.rows.map((row) => ({
      id: String(row.id),
      jobName: String(row.job_name),
      market: toStringOrNull(row.market),
      shardIndex: row.shard_index === null ? null : toNumber(row.shard_index),
      shardCount: row.shard_count === null ? null : toNumber(row.shard_count),
      status: String(row.status),
      startedAt: toStringOrNull(row.started_at),
      completedAt: toStringOrNull(row.completed_at),
      processed: toNumber(row.processed),
      succeeded: toNumber(row.succeeded),
      failed: toNumber(row.failed),
      errorSample: toStringOrNull(row.error_sample),
    })),
    workflowDispatchConfigured: Boolean(workflow.token),
    repository: workflow.repository,
    workflowId: workflow.workflowId,
    ref: workflow.ref,
    maxManualLimit: getManualBatchLimit(),
  };
}
