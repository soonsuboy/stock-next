import { db } from "@/lib/db";

export async function createBatchRunRequest({
  id,
  jobName,
  market,
  message,
}: {
  id: string;
  jobName: string;
  market: string;
  message: string;
}) {
  await db.execute({
    sql: `INSERT INTO batch_runs
          (id, job_name, market, status, started_at, processed, succeeded, failed, error_sample)
          VALUES (?, ?, ?, 'requested', ?, 0, 0, 0, ?)
          ON CONFLICT(id) DO UPDATE SET
            job_name = excluded.job_name,
            market = excluded.market,
            status = excluded.status,
            started_at = excluded.started_at,
            completed_at = NULL,
            processed = 0,
            succeeded = 0,
            failed = 0,
            error_sample = excluded.error_sample`,
    args: [id, jobName, market, new Date().toISOString(), message],
  });
}

export async function markBatchRunRequestFailed(id: string, message: string) {
  await db.execute({
    sql: `UPDATE batch_runs
          SET status = 'failed',
              completed_at = ?,
              failed = 1,
              error_sample = ?
          WHERE id = ?`,
    args: [new Date().toISOString(), message, id],
  });
}
