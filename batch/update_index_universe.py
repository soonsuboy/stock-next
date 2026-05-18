import argparse
import hashlib
import os
import subprocess
import sys
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from db import execute, execute_many
from sector_mapping import infer_gics_sector

UA = (
  os.environ.get("SEC_USER_AGENT")
  or "soonsuboy-stock-next/1.0 soonsuboy@example.com"
)
KST = ZoneInfo("Asia/Seoul")
SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
KOSPI200_URL = "https://en.wikipedia.org/wiki/KOSPI_200"

KOSPI_WIKI_SECTOR_TO_GICS = {
  "Communication Service": "커뮤니케이션",
  "Consumer Discretionary": "경기소비재",
  "Consumer Staples": "필수소비재",
  "Constructions": "산업재",
  "Energy & Chemicals": "에너지",
  "Financials": "금융",
  "Health Care": "헬스케어",
  "Heavy Industries": "산업재",
  "Industrials": "산업재",
  "IT": "정보기술",
  "Steels & Materials": "소재",
  "Utilities": "유틸리티",
}


def now_text() -> str:
  return datetime.now(KST).isoformat(timespec="seconds")


def normalize_us_symbol(symbol: str) -> str:
  return symbol.strip().upper().replace(".", "-")


def normalize_kr_symbol(symbol: str) -> str:
  return "".join(ch for ch in symbol if ch.isdigit()).zfill(6)


def fetch_soup(url: str) -> BeautifulSoup:
  response = requests.get(url, headers={"User-Agent": UA}, timeout=30)
  response.raise_for_status()
  return BeautifulSoup(response.text, "html.parser")


def table_rows_by_header(table: Any) -> list[dict[str, str]]:
  headers = [cell.get_text(" ", strip=True) for cell in table.find_all("th")]
  rows: list[dict[str, str]] = []
  for tr in table.find_all("tr")[1:]:
    cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["td", "th"])]
    if len(cells) < len(headers):
      continue
    rows.append({headers[index]: cells[index] for index in range(len(headers))})
  return rows


def fetch_sec_ticker_map() -> dict[str, str]:
  response = requests.get(
    "https://www.sec.gov/files/company_tickers.json",
    headers={"User-Agent": UA, "Accept-Encoding": "gzip, deflate"},
    timeout=30,
  )
  response.raise_for_status()
  data = response.json()
  out: dict[str, str] = {}
  for row in data.values():
    ticker = normalize_us_symbol(str(row.get("ticker") or ""))
    cik = row.get("cik_str")
    if ticker and cik:
      out[ticker] = str(cik).zfill(10)
  return out


def fetch_dart_corp_map(required: bool) -> dict[str, tuple[str, str]]:
  api_key = (os.environ.get("DART_API_KEY") or "").strip()
  if not api_key:
    if required:
      raise RuntimeError("DART_API_KEY is required for KOSPI200 corp_code mapping")
    print("Warning: DART_API_KEY is not set. KOSPI200 dry-run corp_code will be empty.")
    return {}

  import io
  import zipfile
  import xml.etree.ElementTree as ET

  response = requests.get(
    "https://opendart.fss.or.kr/api/corpCode.xml",
    params={"crtfc_key": api_key},
    timeout=30,
  )
  response.raise_for_status()
  if not zipfile.is_zipfile(io.BytesIO(response.content)):
    raise RuntimeError("DART corpCode.xml did not return a zip file")

  output: dict[str, tuple[str, str]] = {}
  with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
    with archive.open("CORPCODE.xml") as handle:
      tree = ET.parse(handle)
      for item in tree.getroot().findall(".//list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        corp_name = (item.findtext("corp_name") or "").strip()
        if stock_code and corp_code:
          output[stock_code.zfill(6)] = (corp_code.zfill(8), corp_name)
  return output


def fetch_sp500_rows() -> list[dict[str, Any]]:
  soup = fetch_soup(SP500_URL)
  table = soup.find("table", {"id": "constituents"})
  if table is None:
    raise RuntimeError("S&P 500 constituents table not found")

  rows: list[dict[str, Any]] = []
  for item in table_rows_by_header(table):
    code = normalize_us_symbol(item.get("Symbol", ""))
    name = (item.get("Security") or "").strip()
    industry_name = (item.get("GICS Sector") or "").strip()
    if not code or not name:
      continue
    gics_sector, sector_source = infer_gics_sector(
      code=code,
      country="US",
      name=name,
      market="S&P 500",
      industry_name=industry_name,
    )
    rows.append(
      {
        "index_code": "SP500",
        "code": code,
        "country": "US",
        "name": name,
        "market": "S&P 500",
        "currency": "USD",
        "corp_code": None,
        "cik": str(item.get("CIK") or "").zfill(10),
        "gics_sector": gics_sector,
        "industry_name": industry_name,
        "sector_source": sector_source,
        "source": "wikipedia_sp500",
      }
    )
  return rows


def fetch_kospi200_rows(dry_run: bool) -> list[dict[str, Any]]:
  soup = fetch_soup(KOSPI200_URL)
  table = soup.find("table", {"id": "constituents"})
  if table is None:
    raise RuntimeError("KOSPI200 constituents table not found")

  corp_map = fetch_dart_corp_map(required=not dry_run)
  rows: list[dict[str, Any]] = []
  for item in table_rows_by_header(table):
    code = normalize_kr_symbol(item.get("Symbol", ""))
    if not code or code == "000000":
      continue
    fallback_name = (item.get("Company") or "").strip()
    corp_code, corp_name = corp_map.get(code, (None, fallback_name))
    name = corp_name or fallback_name
    industry_name = (item.get("GICS Sector") or "").strip()
    gics_sector = KOSPI_WIKI_SECTOR_TO_GICS.get(industry_name)
    sector_source = "wikipedia_kospi200_sector" if gics_sector else None
    if not gics_sector:
      gics_sector, sector_source = infer_gics_sector(
        code=code,
        country="KR",
        name=name,
        market="KOSPI200",
        industry_name=industry_name,
      )
    rows.append(
      {
        "index_code": "KOSPI200",
        "code": code,
        "country": "KR",
        "name": name,
        "market": "KOSPI200",
        "currency": "KRW",
        "corp_code": corp_code,
        "cik": None,
        "gics_sector": gics_sector,
        "industry_name": industry_name,
        "sector_source": sector_source,
        "source": "wikipedia_kospi200",
      }
    )
  return rows


def ensure_index_schema() -> None:
  execute(
    """CREATE TABLE IF NOT EXISTS index_memberships (
         index_code TEXT NOT NULL,
         code       TEXT NOT NULL,
         country    TEXT NOT NULL CHECK(country IN ('KR', 'US')),
         name       TEXT,
         gics_sector TEXT,
         source     TEXT,
         updated_at TEXT,
         PRIMARY KEY(index_code, code, country)
       )"""
  )
  execute(
    "CREATE INDEX IF NOT EXISTS idx_index_memberships_market ON index_memberships(index_code, country)"
  )


def upsert_index_rows(rows: list[dict[str, Any]]) -> None:
  if not rows:
    return

  timestamp = now_text()
  indexes = sorted({str(row["index_code"]) for row in rows})
  for index_code in indexes:
    execute("DELETE FROM index_memberships WHERE index_code = ?", [index_code])

  company_rows = [
    (
      row["code"],
      row["country"],
      row["name"],
      row["market"],
      row["currency"],
      row["corp_code"],
      row["cik"],
      row["gics_sector"],
      row["industry_name"],
      row["sector_source"],
      row["source"],
      timestamp,
    )
    for row in rows
  ]
  membership_rows = [
    (
      row["index_code"],
      row["code"],
      row["country"],
      row["name"],
      row["gics_sector"],
      row["source"],
      timestamp,
    )
    for row in rows
  ]

  execute_many(
    """INSERT INTO companies
       (code, country, name, market, currency, corp_code, cik,
        gics_sector, industry_name, sector_source, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code, country) DO UPDATE SET
         name = COALESCE(companies.name, excluded.name),
         market = COALESCE(companies.market, excluded.market),
         currency = COALESCE(companies.currency, excluded.currency),
         corp_code = COALESCE(companies.corp_code, excluded.corp_code),
         cik = COALESCE(companies.cik, excluded.cik),
         gics_sector = COALESCE(companies.gics_sector, excluded.gics_sector),
         industry_name = COALESCE(excluded.industry_name, companies.industry_name),
         sector_source = COALESCE(companies.sector_source, excluded.sector_source),
         source = excluded.source,
         updated_at = excluded.updated_at""",
    company_rows,
  )

  execute_many(
    """INSERT INTO index_memberships
       (index_code, code, country, name, gics_sector, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(index_code, code, country) DO UPDATE SET
         name = excluded.name,
         gics_sector = excluded.gics_sector,
         source = excluded.source,
         updated_at = excluded.updated_at""",
    membership_rows,
  )


def in_shard(code: str, country: str, shard_index: int, shard_count: int) -> bool:
  digest = hashlib.sha256(f"{country}:{code}".encode("utf-8")).hexdigest()
  return int(digest, 16) % shard_count == shard_index


def run_command(command: list[str]) -> None:
  print("+", " ".join(command), flush=True)
  result = subprocess.run(command, check=False, text=True)
  if result.returncode != 0:
    raise RuntimeError(f"Command failed exit={result.returncode}: {' '.join(command)}")


def collect_metrics(
  rows: list[dict[str, Any]],
  selection: str,
  limit: int | None,
  dry_run: bool,
  us_shard_index: int,
  us_shard_count: int,
) -> None:
  by_market = {
    "KR": [row for row in rows if row["country"] == "KR"],
    "US": [row for row in rows if row["country"] == "US"],
  }
  if us_shard_count > 1:
    by_market["US"] = [
      row
      for row in by_market["US"]
      if in_shard(str(row["code"]), "US", us_shard_index, us_shard_count)
    ]

  for market, market_rows in by_market.items():
    if not market_rows:
      continue
    codes = [str(row["code"]) for row in market_rows]
    if limit:
      codes = codes[:limit]
    command = [
      sys.executable,
      "batch/update_metrics.py",
      "--market",
      market,
      "--codes",
      ",".join(codes),
      "--selection",
      selection,
    ]
    if dry_run:
      command.append("--dry-run")
    run_command(command)


def start_parent_run(run_id: str) -> None:
  execute(
    """INSERT INTO batch_runs
       (id, job_name, market, status, started_at)
       VALUES (?, 'index_universe_metrics', 'ALL', 'running', ?)
       ON CONFLICT(id) DO UPDATE SET
         job_name = excluded.job_name,
         market = excluded.market,
         status = excluded.status,
         started_at = excluded.started_at,
         completed_at = NULL,
         processed = 0,
         succeeded = 0,
         failed = 0,
         error_sample = NULL""",
    [run_id, now_text()],
  )


def complete_parent_run(
  run_id: str,
  status: str,
  processed: int,
  succeeded: int,
  failed: int,
  message: str,
) -> None:
  execute(
    """UPDATE batch_runs
       SET status = ?, completed_at = ?, processed = ?, succeeded = ?,
           failed = ?, error_sample = ?
       WHERE id = ?""",
    [status, now_text(), processed, succeeded, failed, message, run_id],
  )


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--index", choices=["SP500", "KOSPI200", "ALL"], default="ALL")
  parser.add_argument("--collect-metrics", action="store_true")
  parser.add_argument(
    "--selection",
    choices=["all", "missing", "existing", "incomplete"],
    default="missing",
  )
  parser.add_argument("--limit", type=int)
  parser.add_argument("--run-id")
  parser.add_argument("--us-shard-index", type=int, default=0)
  parser.add_argument("--us-shard-count", type=int, default=1)
  parser.add_argument("--dry-run", action="store_true")
  args = parser.parse_args()

  if args.us_shard_count < 1:
    raise ValueError("--us-shard-count must be at least 1")
  if args.us_shard_index < 0 or args.us_shard_index >= args.us_shard_count:
    raise ValueError("--us-shard-index must be between 0 and us-shard-count - 1")

  rows: list[dict[str, Any]] = []
  if args.index in ["SP500", "ALL"]:
    rows.extend(fetch_sp500_rows())
  if args.index in ["KOSPI200", "ALL"]:
    rows.extend(fetch_kospi200_rows(dry_run=args.dry_run))

  print(
    "Index universe fetched: "
    f"SP500={sum(1 for row in rows if row['index_code'] == 'SP500')}, "
    f"KOSPI200={sum(1 for row in rows if row['index_code'] == 'KOSPI200')}, "
    f"total={len(rows)}"
  )

  parent_started = False
  if args.run_id and not args.dry_run:
    start_parent_run(args.run_id)
    parent_started = True

  try:
    if args.dry_run:
      for row in rows[:10]:
        print(
          f"[DRY] {row['index_code']} {row['country']}:{row['code']} "
          f"{row['name']} sector={row['gics_sector']}"
        )
    else:
      ensure_index_schema()
      upsert_index_rows(rows)

    if args.collect_metrics:
      collect_metrics(
        rows,
        selection=args.selection,
        limit=args.limit,
        dry_run=args.dry_run,
        us_shard_index=args.us_shard_index,
        us_shard_count=args.us_shard_count,
      )

    if parent_started and args.run_id:
      complete_parent_run(
        args.run_id,
        "success",
        len(rows),
        len(rows),
        0,
        "index universe companies and metrics dispatched",
      )
  except Exception as error:
    if parent_started and args.run_id:
      complete_parent_run(args.run_id, "failed", len(rows), 0, len(rows), str(error))
    raise


if __name__ == "__main__":
  main()
