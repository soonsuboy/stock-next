import { db } from "@/lib/db";
import {
  getBatchSchedulerMeta,
  getBatchSettings,
  type BatchSchedulerMeta,
  type BatchSettings,
} from "@/lib/batch-settings";
import { isDiscussionAccessCodeConfigured } from "@/lib/discussion-access";
import { getWorkflowConfig } from "@/lib/github-actions";

export interface BatchCoverage {
  country: string;
  companyCount: number;
  metricsCompanyCount: number;
  missingMetricsCount: number;
  incompleteMetricsCount: number;
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
  settings: BatchSettings;
  schedulerMeta: BatchSchedulerMeta;
  workflowDispatchConfigured: boolean;
  repository: string;
  workflowId: string;
  ref: string;
  maxManualLimit: number;
  discussionAccessCodeConfigured: boolean;
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
  const [
    companiesResult,
    metricsResult,
    incompleteResult,
    runsResult,
    settings,
    schedulerMeta,
    discussionAccessCodeConfigured,
  ] = await Promise.all([
    db.execute({
      sql: `SELECT country, COUNT(*) AS company_count
            FROM companies
            GROUP BY country`,
    }),
    db.execute({
      sql: `SELECT
              country,
              COUNT(DISTINCT code) AS metrics_company_count,
              COUNT(*) AS metrics_row_count,
              MAX(snapshot_date) AS latest_snapshot
            FROM metrics_history
            GROUP BY country`,
    }),
    db.execute({
      sql: `WITH latest AS (
              SELECT code, country, MAX(snapshot_date) AS snapshot_date
              FROM metrics_history
              GROUP BY code, country
            )
            SELECT m.country, COUNT(*) AS incomplete_metrics_count
            FROM latest l
            JOIN metrics_history m
              ON m.code = l.code
             AND m.country = l.country
             AND m.snapshot_date = l.snapshot_date
            WHERE m.equity IS NULL OR m.net_income IS NULL
            GROUP BY m.country`,
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
            LIMIT 100`,
    }),
    getBatchSettings(),
    getBatchSchedulerMeta(),
    isDiscussionAccessCodeConfigured(),
  ]);

  const workflow = getWorkflowConfig();
  const metricsByCountry = new Map(
    metricsResult.rows.map((row) => [
      String(row.country),
      {
        metricsCompanyCount: toNumber(row.metrics_company_count),
        metricsRowCount: toNumber(row.metrics_row_count),
        latestSnapshot: toStringOrNull(row.latest_snapshot),
      },
    ])
  );
  const incompleteByCountry = new Map(
    incompleteResult.rows.map((row) => [
      String(row.country),
      toNumber(row.incomplete_metrics_count),
    ])
  );

  return {
    coverage: companiesResult.rows.map((row) => {
      const country = String(row.country);
      const companyCount = toNumber(row.company_count);
      const metrics = metricsByCountry.get(country) || {
        metricsCompanyCount: 0,
        metricsRowCount: 0,
        latestSnapshot: null,
      };
      return {
        country,
        companyCount,
        metricsCompanyCount: metrics.metricsCompanyCount,
        missingMetricsCount: Math.max(0, companyCount - metrics.metricsCompanyCount),
        incompleteMetricsCount: incompleteByCountry.get(country) || 0,
        latestSnapshot: metrics.latestSnapshot,
        metricsRowCount: metrics.metricsRowCount,
      };
    }),
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
    settings,
    schedulerMeta,
    workflowDispatchConfigured: Boolean(workflow.token),
    repository: workflow.repository,
    workflowId: workflow.workflowId,
    ref: workflow.ref,
    maxManualLimit: getManualBatchLimit(),
    discussionAccessCodeConfigured,
  };
}
