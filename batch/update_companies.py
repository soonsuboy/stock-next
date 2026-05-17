import argparse
import io
import os
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import requests

from db import execute_many

UA = (
  os.environ.get("SEC_USER_AGENT")
  or "soonsuboy-stock-next/1.0 soonsuboy@example.com"
)
KST = ZoneInfo("Asia/Seoul")


def normalize_us_symbol(symbol: str) -> str:
  return symbol.strip().upper().replace(".", "-")


def is_us_common_stock(name: str) -> bool:
  return "common stock" in name.lower()


def now_text() -> str:
  return datetime.now(KST).isoformat(timespec="seconds")


def fetch_kr_companies() -> tuple[list[tuple[Any, ...]], list[tuple[Any, ...]]]:
  api_key = (os.environ.get("DART_API_KEY") or "").strip()
  if not api_key:
    raise RuntimeError("DART_API_KEY is not set")

  response = requests.get(
    "https://opendart.fss.or.kr/api/corpCode.xml",
    params={"crtfc_key": api_key},
    timeout=30,
  )
  response.raise_for_status()

  timestamp = now_text()
  corp_rows: list[tuple[Any, ...]] = []
  company_rows: list[tuple[Any, ...]] = []

  with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
    with archive.open("CORPCODE.xml") as handle:
      tree = ET.parse(handle)
      for item in tree.getroot().findall(".//list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        corp_name = (item.findtext("corp_name") or "").strip()
        if not stock_code or not corp_code:
          continue

        code = stock_code.zfill(6)
        corp = corp_code.zfill(8)
        corp_rows.append((code, corp, corp_name, timestamp))
        company_rows.append(
          (
            code,
            "KR",
            corp_name,
            "KRX",
            "KRW",
            corp,
            None,
            "dart_corp_code",
            timestamp,
          )
        )

  return corp_rows, company_rows


def fetch_sec_ticker_map() -> dict[str, str]:
  try:
    response = requests.get(
      "https://www.sec.gov/files/company_tickers.json",
      headers={"User-Agent": UA},
      timeout=30,
    )
    response.raise_for_status()
  except requests.RequestException as error:
    print(f"Warning: SEC ticker map unavailable: {error}")
    return {}

  data = response.json()
  out: dict[str, str] = {}

  for row in data.values():
    ticker = str(row.get("ticker") or "").upper()
    cik = row.get("cik_str")
    if ticker and cik:
      value = str(cik).zfill(10)
      out[ticker] = value
      out[normalize_us_symbol(ticker)] = value

  return out


def fetch_us_companies() -> list[tuple[Any, ...]]:
  cik_map = fetch_sec_ticker_map()
  timestamp = now_text()
  rows: list[tuple[Any, ...]] = []
  sources = [
    ("https://nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", "NASDAQ"),
    ("https://nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", "NYSE"),
  ]

  for url, default_market in sources:
    response = requests.get(url, headers={"User-Agent": UA}, timeout=30)
    response.raise_for_status()
    lines = [line.strip() for line in response.text.splitlines() if line.strip()]
    if not lines:
      continue

    header = lines[0].split("|")
    for line in lines[1:]:
      if line.startswith("File Creation"):
        continue

      parts = line.split("|")
      raw = {key: parts[index] if index < len(parts) else "" for index, key in enumerate(header)}
      raw_symbol = (raw.get("Symbol") or raw.get("ACT Symbol") or "").strip().upper()
      symbol = normalize_us_symbol(raw_symbol)
      name = (raw.get("Security Name") or "").strip()
      if not symbol or not name:
        continue
      if not is_us_common_stock(name):
        continue
      if raw.get("Test Issue") == "Y" or raw.get("ETF") == "Y":
        continue
      if any(char in raw_symbol for char in ["$", "="]):
        continue

      exchange = raw.get("Exchange") or ""
      market = default_market
      if exchange == "N":
        market = "NYSE"
      elif exchange == "A":
        market = "AMEX"
      elif exchange == "Q":
        market = "NASDAQ"

      rows.append(
        (
          symbol,
          "US",
          name,
          market,
          "USD",
          None,
          cik_map.get(symbol),
          "nasdaq_trader_sec",
          timestamp,
        )
      )

  return rows


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--market", choices=["KR", "US", "ALL"], default="ALL")
  parser.add_argument("--limit", type=int, help=argparse.SUPPRESS)
  parser.add_argument("--dry-run", action="store_true")
  args = parser.parse_args()

  company_rows: list[tuple[Any, ...]] = []
  corp_rows: list[tuple[Any, ...]] = []

  if args.market in ["KR", "ALL"]:
    corp_rows, kr_rows = fetch_kr_companies()
    company_rows.extend(kr_rows)
    print(f"KR companies: {len(kr_rows)}")

  if args.market in ["US", "ALL"]:
    us_rows = fetch_us_companies()
    company_rows.extend(us_rows)
    print(f"US companies: {len(us_rows)}")

  if args.dry_run:
    print(f"Dry run only. corp_codes={len(corp_rows)}, companies={len(company_rows)}")
    return

  if corp_rows:
    execute_many(
      """INSERT INTO corp_codes(stock_code, corp_code, corp_name, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(stock_code) DO UPDATE SET
           corp_code = excluded.corp_code,
           corp_name = excluded.corp_name,
           updated_at = excluded.updated_at""",
      corp_rows,
    )

  if company_rows:
    execute_many(
      """INSERT INTO companies
         (code, country, name, market, currency, corp_code, cik, source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code, country) DO UPDATE SET
           name = excluded.name,
           market = excluded.market,
           currency = excluded.currency,
           corp_code = COALESCE(excluded.corp_code, companies.corp_code),
           cik = COALESCE(excluded.cik, companies.cik),
           source = excluded.source,
           updated_at = excluded.updated_at""",
      company_rows,
    )

  print(f"Inserted/updated companies: {len(company_rows)}")


if __name__ == "__main__":
  main()
