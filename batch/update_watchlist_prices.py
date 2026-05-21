import argparse
import json
import time
import uuid
from typing import Any

from db import execute, execute_many
from update_metrics import (
  ADR_SHARE_RATIO,
  fetch_best_quote,
  now_text,
  price_change_rate,
  safe_div,
  today_text,
  to_number,
)


def load_watchlist_targets(market: str, limit: int | None) -> list[dict[str, Any]]:
  args: list[Any] = []
  where = ""
  if market != "ALL":
    where = "WHERE uw.country = ?"
    args.append(market)

  limit_sql = ""
  if limit:
    limit_sql = "LIMIT ?"
    args.append(limit)

  result = execute(
    f"""WITH targets AS (
          SELECT DISTINCT uw.code, uw.country
          FROM user_watchlist uw
          {where}
        ),
        latest AS (
          SELECT code, country, MAX(snapshot_date) AS snapshot_date
          FROM metrics_history
          GROUP BY code, country
        )
        SELECT
          t.code,
          t.country,
          c.name,
          c.market,
          c.currency,
          m.snapshot_date AS source_snapshot_date,
          m.close_price,
          m.previous_close,
          m.change_rate,
          m.market_cap,
          m.shares_outstanding,
          m.equity,
          m.net_income,
          m.operating_income,
          m.total_liabilities,
          m.debt_ratio,
          m.foreign_ratio,
          m.institution_ratio,
          m.report_code,
          m.bsns_year,
          m.source
        FROM targets t
        JOIN companies c
          ON t.code = c.code AND t.country = c.country
        LEFT JOIN latest l
          ON t.code = l.code AND t.country = l.country
        LEFT JOIN metrics_history m
          ON m.code = l.code
         AND m.country = l.country
         AND m.snapshot_date = l.snapshot_date
        ORDER BY t.country, t.code
        {limit_sql}""",
    args,
  )
  return result["rows"]


def load_metric_targets(
  market: str,
  limit: int | None,
  missing_change_only: bool,
) -> list[dict[str, Any]]:
  args: list[Any] = []
  filters: list[str] = []
  if market != "ALL":
    filters.append("m.country = ?")
    args.append(market)
  if missing_change_only:
    filters.append("(m.previous_close IS NULL OR m.change_rate IS NULL)")

  where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
  limit_sql = ""
  if limit:
    limit_sql = "LIMIT ?"
    args.append(limit)

  result = execute(
    f"""WITH latest AS (
          SELECT code, country, MAX(snapshot_date) AS snapshot_date
          FROM metrics_history
          GROUP BY code, country
        )
        SELECT
          m.code,
          m.country,
          COALESCE(c.name, m.name) AS name,
          c.market,
          COALESCE(m.currency, c.currency) AS currency,
          m.snapshot_date AS source_snapshot_date,
          m.close_price,
          m.previous_close,
          m.change_rate,
          m.market_cap,
          m.shares_outstanding,
          m.equity,
          m.net_income,
          m.operating_income,
          m.total_liabilities,
          m.debt_ratio,
          m.foreign_ratio,
          m.institution_ratio,
          m.report_code,
          m.bsns_year,
          m.source
        FROM latest l
        JOIN metrics_history m
          ON m.code = l.code
         AND m.country = l.country
         AND m.snapshot_date = l.snapshot_date
        LEFT JOIN companies c
          ON m.code = c.code AND m.country = c.country
        {where_sql}
        ORDER BY m.country, m.code
        {limit_sql}""",
    args,
  )
  return result["rows"]


def implied_shares(row: dict[str, Any]) -> float | None:
  market_cap = to_number(row.get("market_cap"))
  close_price = to_number(row.get("close_price"))
  return safe_div(market_cap, close_price)


def parse_source(value: Any) -> dict[str, Any]:
  if isinstance(value, str) and value.strip():
    try:
      parsed = json.loads(value)
      if isinstance(parsed, dict):
        return parsed
    except json.JSONDecodeError:
      return {"financials": value}
  return {}


def build_source(row: dict[str, Any], market_source: str) -> str:
  source = parse_source(row.get("source"))
  if not source.get("financials"):
    source["financials"] = "latest_metrics_history"
  source["market"] = market_source
  source["price_refresh"] = True
  source["price_refresh_at"] = now_text()
  source["price_refresh_from_snapshot_date"] = row.get("source_snapshot_date")
  return json.dumps(source, ensure_ascii=False)


def fetch_latest_price_and_shares(
  row: dict[str, Any]
) -> tuple[
  float | None,
  float | None,
  float | None,
  float | None,
  float | None,
  str,
]:
  country = str(row["country"])
  code = str(row["code"])
  stored_shares = to_number(row.get("shares_outstanding")) or implied_shares(row)
  quote = fetch_best_quote(country, code, row.get("market"))
  market_source = str(quote.get("source") or ("daum" if country == "KR" else "stooq"))

  if country == "KR":
    price = to_number(quote.get("price"))
    previous_close = to_number(quote.get("previous_close"))
    quote_shares = to_number(quote.get("shares"))
    shares = quote_shares or stored_shares
    market_cap = to_number(quote.get("market_cap"))
    if market_cap is None and price is not None and shares is not None:
      market_cap = price * shares
    return price, previous_close, price_change_rate(price, previous_close), market_cap, shares, market_source

  price = to_number(quote.get("price"))
  previous_close = to_number(quote.get("previous_close"))
  shares = stored_shares
  ratio = ADR_SHARE_RATIO.get(code, 1.0)
  if ratio != 1.0 and shares is not None and shares > 10_000_000_000:
    shares = shares / ratio
  market_cap = price * shares if price is not None and shares is not None else None
  return price, previous_close, price_change_rate(price, previous_close), market_cap, shares, market_source


def build_metric_row(row: dict[str, Any]) -> tuple[Any, ...]:
  price, previous_close, change_rate, market_cap, shares, market_source = (
    fetch_latest_price_and_shares(row)
  )
  if price is None:
    raise RuntimeError("latest price is missing")
  if market_cap is None:
    raise RuntimeError("market cap cannot be calculated without shares")

  equity = to_number(row.get("equity"))
  net_income = to_number(row.get("net_income"))
  operating_income = to_number(row.get("operating_income"))
  total_liabilities = to_number(row.get("total_liabilities"))
  debt_ratio = to_number(row.get("debt_ratio"))
  if debt_ratio is None:
    debt_raw = safe_div(total_liabilities, equity)
    debt_ratio = debt_raw * 100 if debt_raw is not None else None
  foreign_ratio = to_number(row.get("foreign_ratio"))
  institution_ratio = to_number(row.get("institution_ratio"))
  per = safe_div(market_cap, net_income)
  pbr = safe_div(market_cap, equity)
  roe = safe_div(net_income, equity)

  return (
    today_text(),
    row["code"],
    row["country"],
    row.get("name"),
    row.get("currency") or ("KRW" if row["country"] == "KR" else "USD"),
    price,
    previous_close,
    change_rate,
    market_cap,
    shares,
    equity,
    net_income,
    operating_income,
    total_liabilities,
    debt_ratio,
    foreign_ratio,
    institution_ratio,
    per,
    pbr,
    roe * 100 if roe is not None else None,
    row.get("report_code"),
    row.get("bsns_year"),
    build_source(row, market_source),
    now_text(),
  )


def flush(metric_rows: list[tuple[Any, ...]], item_rows: list[tuple[Any, ...]]) -> None:
  if metric_rows:
    execute_many(
      """INSERT INTO metrics_history
         (snapshot_date, code, country, name, currency, close_price,
          previous_close, change_rate, market_cap, shares_outstanding, equity,
          net_income, operating_income,
          total_liabilities, debt_ratio, foreign_ratio, institution_ratio,
          per, pbr, roe, report_code, bsns_year, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(snapshot_date, code, country) DO UPDATE SET
           name = excluded.name,
           currency = excluded.currency,
           close_price = excluded.close_price,
           previous_close = excluded.previous_close,
           change_rate = excluded.change_rate,
           market_cap = excluded.market_cap,
           shares_outstanding = excluded.shares_outstanding,
           equity = excluded.equity,
           net_income = excluded.net_income,
           operating_income = excluded.operating_income,
           total_liabilities = excluded.total_liabilities,
           debt_ratio = excluded.debt_ratio,
           foreign_ratio = excluded.foreign_ratio,
           institution_ratio = excluded.institution_ratio,
           per = excluded.per,
           pbr = excluded.pbr,
           roe = excluded.roe,
           report_code = excluded.report_code,
           bsns_year = excluded.bsns_year,
           source = excluded.source,
           created_at = excluded.created_at""",
      metric_rows,
    )

  if item_rows:
    execute_many(
      """INSERT INTO batch_run_items
         (run_id, code, country, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id, code, country) DO UPDATE SET
           status = excluded.status,
           error = excluded.error,
           created_at = excluded.created_at""",
      item_rows,
    )


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--market", choices=["KR", "US", "ALL"], default="ALL")
  parser.add_argument(
    "--scope",
    choices=["watchlist", "metrics"],
    default="watchlist",
    help="watchlist refreshes only user watchlists; metrics refreshes latest metrics rows",
  )
  parser.add_argument(
    "--missing-change-only",
    action="store_true",
    help="With --scope metrics, process only rows missing previous_close or change_rate",
  )
  parser.add_argument("--limit", type=int)
  parser.add_argument("--dry-run", action="store_true")
  parser.add_argument("--run-id")
  args = parser.parse_args()

  targets = (
    load_metric_targets(args.market, args.limit, args.missing_change_only)
    if args.scope == "metrics"
    else load_watchlist_targets(args.market, args.limit)
  )
  run_id = args.run_id or str(uuid.uuid4())
  job_name = (
    "update_metric_prices"
    if args.scope == "metrics"
    else "update_watchlist_prices"
  )

  if not args.dry_run:
    execute(
      """INSERT INTO batch_runs
         (id, job_name, market, shard_index, shard_count, status, started_at)
         VALUES (?, ?, ?, NULL, NULL, 'running', ?)
         ON CONFLICT(id) DO UPDATE SET
           job_name = excluded.job_name,
           market = excluded.market,
           shard_index = excluded.shard_index,
           shard_count = excluded.shard_count,
           status = excluded.status,
           started_at = excluded.started_at,
           completed_at = NULL,
           processed = 0,
           succeeded = 0,
           failed = 0,
           error_sample = NULL""",
      [run_id, job_name, args.market, now_text()],
    )

  processed = 0
  succeeded = 0
  failed = 0
  error_sample: list[str] = []
  metric_rows: list[tuple[Any, ...]] = []
  item_rows: list[tuple[Any, ...]] = []

  try:
    for target in targets:
      processed += 1
      code = str(target["code"])
      country = str(target["country"])
      try:
        row = build_metric_row(target)
        succeeded += 1
        if args.dry_run:
          print(f"[OK] {country}:{code} {target.get('name')}")
        else:
          metric_rows.append(row)
          item_rows.append((run_id, code, country, "success", None, now_text()))
      except Exception as error:
        failed += 1
        message = f"{country}:{code} {error}"
        error_sample.append(message)
        print(f"[ERROR] {message}")
        if not args.dry_run:
          item_rows.append((run_id, code, country, "error", str(error), now_text()))
      finally:
        time.sleep(0.15 if country == "US" else 0.05)

      if not args.dry_run and (len(metric_rows) >= 400 or len(item_rows) >= 400):
        flush(metric_rows, item_rows)
        metric_rows.clear()
        item_rows.clear()

    if not args.dry_run:
      flush(metric_rows, item_rows)
      execute(
        """UPDATE batch_runs
           SET status = ?, completed_at = ?, processed = ?, succeeded = ?,
               failed = ?, error_sample = ?
           WHERE id = ?""",
        [
          "success" if failed == 0 else "partial",
          now_text(),
          processed,
          succeeded,
          failed,
          "\n".join(error_sample[:20]),
          run_id,
        ],
      )

    print(
      f"Done. market={args.market}, processed={processed}, succeeded={succeeded}, failed={failed}"
    )
  except Exception as fatal:
    if not args.dry_run:
      execute(
        """UPDATE batch_runs
           SET status = 'failed', completed_at = ?, processed = ?,
               succeeded = ?, failed = ?, error_sample = ?
           WHERE id = ?""",
        [now_text(), processed, succeeded, failed, str(fatal), run_id],
      )
    raise


if __name__ == "__main__":
  main()
