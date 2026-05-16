# 0014 - Fix Scheduled Batch And US CIK Hydration

## Request

- Vercel admin batch settings were changed, but scheduled batch did not execute.
- US manual batch could not collect any data.
- Inspect available logs and improve the system.

## Findings

- GitHub Actions schedule runs existed and completed successfully, but collection was skipped.
- The DB setting was:
  - `schedule_time_kst=21:00`
  - `schedule_window_minutes=60`
- GitHub scheduled runs were delayed past the 60 minute window. The scheduler treated those delayed runs as outside the execution window and exited successfully without collecting data.
- Recent US manual batch logs showed:
  - `US:A CIK is missing`
  - `US:AA CIK is missing`
  - and similar errors for the first 100 US symbols.
- DB check showed all US company master rows had empty `cik` values before the fix.

## Implementation

- Updated `batch/run_scheduled.py`.
  - Scheduled runs now execute once per KST date after the configured target time, even if GitHub Actions starts late.
  - The old window now acts as a late-warning threshold in logs instead of a hard skip.
  - Every scheduled check stores:
    - `last_scheduler_check_at`
    - `last_scheduler_check_reason`
    - latest automatic run started/completed/status metadata.
- Updated scheduler defaults from 60 minutes to 1440 minutes for new installs.
- Updated `batch/update_metrics.py`.
  - Fetches SEC ticker maps during US metric runs.
  - Hydrates missing US CIK values at runtime.
  - Persists hydrated CIK values during real runs.
  - Does not persist CIK values during `--dry-run`.
  - Filters non-code-targeted US runs to companies with known CIKs before applying `--limit`.
- Updated admin status data and dashboard.
  - Shows latest scheduler check time.
  - Shows latest scheduler check reason.
  - Shows latest automatic run date/status.
  - Clarifies that the delay setting is a warning threshold and does not block the first due run.

## Data Repair Performed

- Ran a real small US batch:
  - `python batch/update_metrics.py --market US --limit 3`
  - Result: processed 3, succeeded 3, failed 0.
- This also hydrated US company CIK values in Turso:
  - before: 0 with CIK
  - after: 6,879 with CIK, 134 missing CIK

## Verification

- `python -m compileall batch` passed.
- `python batch/migrate_db.py` passed.
- `python batch/run_scheduled.py` passed and stored a scheduler check reason:
  - `before schedule target=21:00`
- `python batch/update_metrics.py --market US --limit 5 --dry-run` passed:
  - processed 5, succeeded 5, failed 0.
- `python batch/update_metrics.py --market US --limit 3` passed:
  - processed 3, succeeded 3, failed 0.
- `npm run lint` passed.
- `npm run build` passed.

## Modified Files

- `app/admin/AdminDashboard.tsx`
- `batch/migrate_db.py`
- `batch/run_scheduled.py`
- `batch/update_metrics.py`
- `lib/admin-data.ts`
- `lib/batch-settings.ts`
- `project-logs/0014-fix-scheduled-batch-and-us-cik.md`

## Notes For Next Agent

- GitHub scheduled workflows are not guaranteed to start exactly on the cron minute. Avoid narrow hard windows for scheduled execution.
- US manual batches should now work even if `companies.cik` is empty, because the metric script hydrates CIKs from SEC ticker maps.
- Some instruments may still fail if SEC has no usable financial facts, but broad US batches should no longer fail 100% due to missing CIK.
