import argparse
import csv
import hashlib
import json
import os
import time
import uuid
from datetime import datetime
from io import StringIO
from typing import Any
from zoneinfo import ZoneInfo

import requests

from db import execute, execute_many

UA = (
  os.environ.get("SEC_USER_AGENT")
  or "soonsuboy-stock-next/1.0 soonsuboy@example.com"
)
DART_BASE = "https://opendart.fss.or.kr/api"
KST = ZoneInfo("Asia/Seoul")
REPORT_CODES = [
  ("11011", "사업보고서"),
  ("11014", "3분기보고서"),
  ("11012", "반기보고서"),
  ("11013", "1분기보고서"),
]
ACCOUNT_PATTERNS = {
  "equity": ["자본총계"],
  "net_income": ["당기순이익", "당기순이익(손실)", "연결당기순이익"],
  "operating_income": ["영업이익", "영업이익(손실)"],
  "total_liabilities": ["부채총계"],
}
SEC_ALLOWED_FORMS = {"10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "20-F", "20-F/A", "6-K"}
KNOWN_US_CIKS = {
  "AAPL": "0000320193",
  "AMZN": "0001018724",
  "AVGO": "0001730168",
  "BRK-B": "0001067983",
  "GOOG": "0001652044",
  "GOOGL": "0001652044",
  "JPM": "0000019617",
  "LLY": "0000059478",
  "META": "0001326801",
  "MSFT": "0000789019",
  "NVDA": "0001045810",
  "TSLA": "0001318605",
  "TSM": "0001046179",
  "WMT": "0000104169",
}
ADR_SHARE_RATIO = {
  # TSM ADS represents 5 ordinary shares. SEC reports ordinary shares, while Stooq
  # quotes the NYSE ADS, so divide shares before calculating USD market cap.
  "TSM": 5.0,
}
SEC_TICKER_MAP: dict[str, str] | None = None


def now_text() -> str:
  return datetime.now().isoformat(timespec="seconds")


def today_text() -> str:
  return datetime.now(KST).date().isoformat()


def safe_div(a: float | None, b: float | None) -> float | None:
  if a is None or b is None or b == 0:
    return None
  value = a / b
  return value if value not in [float("inf"), float("-inf")] else None


def to_number(value: Any) -> float | None:
  if value is None:
    return None
  if isinstance(value, (int, float)):
    return float(value)
  text = str(value).replace(",", "").strip()
  if not text or text == "-":
    return None
  try:
    return float(text)
  except ValueError:
    return None


def load_companies(market: str) -> list[dict[str, Any]]:
  result = execute(
    """SELECT code, country, name, market, currency, corp_code, cik
       FROM companies
       WHERE country = ?
       ORDER BY code""",
    [market],
  )
  return result["rows"]


def load_metric_keys(market: str) -> set[tuple[str, str]]:
  result = execute(
    """SELECT code, country
       FROM metrics_history
       WHERE country = ?
       GROUP BY code, country""",
    [market],
  )
  return {(str(row["code"]), str(row["country"])) for row in result["rows"]}


def fetch_sec_ticker_map() -> dict[str, str]:
  global SEC_TICKER_MAP
  if SEC_TICKER_MAP is not None:
    return SEC_TICKER_MAP

  out = dict(KNOWN_US_CIKS)
  urls = [
    "https://www.sec.gov/files/company_tickers.json",
    "https://www.sec.gov/files/company_tickers_exchange.json",
  ]

  for url in urls:
    try:
      response = requests.get(
        url,
        headers={
          "User-Agent": UA,
          "Accept-Encoding": "gzip, deflate",
        },
        timeout=30,
      )
      response.raise_for_status()
      data = response.json()
    except requests.RequestException as error:
      print(f"Warning: SEC ticker map unavailable: {url} {error}")
      continue

    if isinstance(data, dict) and isinstance(data.get("data"), list):
      fields = [str(field) for field in data.get("fields") or []]
      try:
        cik_index = fields.index("cik")
        ticker_index = fields.index("ticker")
      except ValueError:
        continue

      for row in data["data"]:
        if not isinstance(row, list):
          continue
        if len(row) <= max(cik_index, ticker_index):
          continue
        ticker = normalize_code(str(row[ticker_index]), "US")
        cik = str(row[cik_index]).zfill(10)
        if ticker and cik != "0000000000":
          out[ticker] = cik
    elif isinstance(data, dict):
      for row in data.values():
        if not isinstance(row, dict):
          continue
        ticker = normalize_code(str(row.get("ticker") or ""), "US")
        cik = row.get("cik_str")
        if ticker and cik:
          out[ticker] = str(cik).zfill(10)

  SEC_TICKER_MAP = out
  return out


def hydrate_us_ciks(companies: list[dict[str, Any]], persist: bool) -> list[dict[str, Any]]:
  if not companies:
    return companies

  cik_map = fetch_sec_ticker_map()
  update_rows: list[tuple[Any, ...]] = []

  for company in companies:
    code = normalize_code(str(company.get("code") or ""), "US")
    existing = str(company.get("cik") or "").strip()
    if existing:
      company["cik"] = existing.zfill(10)
      continue

    cik = cik_map.get(code)
    if cik:
      company["cik"] = cik
      update_rows.append((cik, now_text(), code))

  if persist and update_rows:
    execute_many(
      """UPDATE companies
         SET cik = ?, updated_at = ?
         WHERE country = 'US' AND code = ?""",
      update_rows,
    )

  return companies


def normalize_code(code: str, market: str) -> str:
  text = code.strip().upper()
  if market == "KR":
    return text.zfill(6)
  return text.replace(".", "-")


def in_shard(code: str, country: str, shard_index: int, shard_count: int) -> bool:
  digest = hashlib.sha256(f"{country}:{code}".encode("utf-8")).hexdigest()
  return int(digest, 16) % shard_count == shard_index


def fetch_kr_quote(code: str) -> dict[str, Any]:
  response = requests.get(
    "https://finance.daum.net/api/search/quotes",
    params={"q": code, "limit": 5},
    headers={
      "User-Agent": UA,
      "Referer": "https://finance.daum.net/",
    },
    timeout=15,
  )
  response.raise_for_status()
  data = response.json()

  for item in data.get("quotes") or []:
    symbol = str(item.get("symbolCode") or "").removeprefix("A")
    if symbol != code or not item.get("isStock") or item.get("isDelisted"):
      continue

    price = to_number(item.get("tradePrice"))
    shares = to_number(item.get("listedShareCount"))
    return {
      "price": price,
      "market_cap": price * shares if price is not None and shares is not None else None,
      "shares": shares,
      "market": item.get("market") or "KRX",
      "name": item.get("name"),
    }

  return {"price": None, "market_cap": None, "shares": None}


def match_account(items: list[dict[str, Any]], patterns: list[str]) -> float | None:
  for item in items:
    if item.get("account_nm") in patterns:
      return to_number(item.get("thstrm_amount"))
  for pattern in patterns:
    for item in items:
      if pattern in str(item.get("account_nm") or ""):
        return to_number(item.get("thstrm_amount"))
  return None


def fetch_dart_financials(company: dict[str, Any]) -> dict[str, Any]:
  api_key = (os.environ.get("DART_API_KEY") or "").strip()
  if not api_key:
    raise RuntimeError("DART_API_KEY is not set")

  corp_code = str(company.get("corp_code") or "").zfill(8)
  if not corp_code or corp_code == "00000000":
    raise RuntimeError("corp_code is missing")

  output: dict[str, Any] = {
    "equity": None,
    "net_income": None,
    "operating_income": None,
    "total_liabilities": None,
    "bsns_year": None,
    "report_code": None,
    "source": "dart_not_found",
  }
  year = datetime.now().year

  for try_year in [year, year - 1]:
    for report_code, report_name in REPORT_CODES:
      for fs_div in ["CFS", "OFS"]:
        response = requests.get(
          f"{DART_BASE}/fnlttSinglAcntAll.json",
          params={
            "crtfc_key": api_key,
            "corp_code": corp_code,
            "bsns_year": str(try_year),
            "reprt_code": report_code,
            "fs_div": fs_div,
          },
          timeout=15,
        )
        data = response.json()
        if data.get("status") != "000":
          continue

        items = data.get("list") or []
        if not items:
          continue

        for key, patterns in ACCOUNT_PATTERNS.items():
          if output[key] is None:
            output[key] = match_account(items, patterns)

        output["bsns_year"] = str(try_year)
        output["report_code"] = report_code
        output["source"] = f"dart/{fs_div}/{report_name}/{try_year}"

        if output["equity"] is not None and output["net_income"] is not None:
          return output
        break

  return output


def fetch_stooq_quote(symbol: str) -> dict[str, Any]:
  response = requests.get(
    "https://stooq.com/q/l/",
    params={"s": f"{symbol.lower()}.us", "f": "sd2t2ohlcv", "h": "", "e": "csv"},
    headers={"User-Agent": UA},
    timeout=15,
  )
  response.raise_for_status()
  reader = csv.DictReader(StringIO(response.text))
  row = next(reader, None)
  if not row or row.get("Close") == "N/D":
    return {"price": None}
  return {"price": to_number(row.get("Close"))}


def fetch_yahoo_shares(symbol: str) -> float | None:
  types = [
    "quarterlyBasicAverageShares",
    "annualBasicAverageShares",
    "annualDilutedAverageShares",
  ]
  response = requests.get(
    f"https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}",
    params={
      "symbol": symbol,
      "type": ",".join(types),
      "period1": 0,
      "period2": int(time.time()),
    },
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=20,
  )
  response.raise_for_status()
  results = (response.json().get("timeseries") or {}).get("result") or []
  values_by_type: dict[str, list[dict[str, Any]]] = {}

  for item in results:
    item_type = ((item.get("meta") or {}).get("type") or [None])[0]
    if item_type in types:
      values_by_type[item_type] = item.get(item_type) or []

  for item_type in types:
    values = [
      row
      for row in values_by_type.get(item_type, [])
      if ((row.get("reportedValue") or {}).get("raw") is not None)
    ]
    values.sort(key=lambda row: str(row.get("asOfDate") or ""), reverse=True)
    if values:
      return to_number((values[0].get("reportedValue") or {}).get("raw"))

  return None


def latest_fact(
  facts: dict[str, Any],
  taxonomy: str,
  concepts: list[str],
  units: list[str],
  allow_quarterly: bool = False,
) -> dict[str, Any] | None:
  candidates: list[dict[str, Any]] = []
  taxonomy_block = facts.get(taxonomy) or {}

  for concept in concepts:
    concept_block = taxonomy_block.get(concept) or {}
    unit_block = concept_block.get("units") or {}
    for unit in units:
      for row in unit_block.get(unit) or []:
        value = row.get("val")
        form = str(row.get("form") or "")
        fp = str(row.get("fp") or "")
        is_annual = fp == "FY" or form in ["10-K", "10-K/A"]
        if value is None:
          continue
        if not allow_quarterly and not is_annual:
          continue
        if form and form not in SEC_ALLOWED_FORMS:
          continue
        candidates.append(row)

  candidates.sort(
    key=lambda item: (str(item.get("filed") or ""), str(item.get("end") or "")),
    reverse=True,
  )
  return candidates[0] if candidates else None


def fetch_sec_financials(company: dict[str, Any]) -> dict[str, Any]:
  code = str(company.get("code") or "").upper()
  cik = str(company.get("cik") or KNOWN_US_CIKS.get(code) or "").zfill(10)
  if not cik or cik == "0000000000":
    raise RuntimeError("CIK is missing")

  response = requests.get(
    f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
    headers={
      "User-Agent": os.environ.get("SEC_USER_AGENT") or UA,
      "Accept-Encoding": "gzip, deflate",
    },
    timeout=30,
  )
  response.raise_for_status()
  facts = response.json().get("facts") or {}

  equity = latest_fact(
    facts,
    "us-gaap",
    [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    ["USD"],
  )
  net_income = latest_fact(
    facts,
    "us-gaap",
    ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    ["USD"],
  )
  operating_income = latest_fact(
    facts,
    "us-gaap",
    ["OperatingIncomeLoss"],
    ["USD"],
  )
  liabilities = latest_fact(
    facts,
    "us-gaap",
    ["Liabilities"],
    ["USD"],
  )
  taxonomy = "us-gaap"

  if equity is None or net_income is None:
    ifrs_equity = latest_fact(
      facts,
      "ifrs-full",
      ["EquityAttributableToOwnersOfParent", "Equity"],
      ["USD"],
    )
    ifrs_net_income = latest_fact(
      facts,
      "ifrs-full",
      ["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
      ["USD"],
    )
    ifrs_operating_income = latest_fact(
      facts,
      "ifrs-full",
      ["ProfitLossFromOperatingActivities"],
      ["USD"],
    )
    ifrs_liabilities = latest_fact(
      facts,
      "ifrs-full",
      ["Liabilities"],
      ["USD"],
    )
    equity = equity or ifrs_equity
    net_income = net_income or ifrs_net_income
    operating_income = operating_income or ifrs_operating_income
    liabilities = liabilities or ifrs_liabilities
    if any([ifrs_equity, ifrs_net_income, ifrs_operating_income, ifrs_liabilities]):
      taxonomy = "ifrs-full"

  shares = latest_fact(
    facts,
    "dei",
    ["EntityCommonStockSharesOutstanding"],
    ["shares"],
    allow_quarterly=True,
  )
  anchor = equity or net_income or operating_income or liabilities

  return {
    "equity": to_number(equity.get("val") if equity else None),
    "net_income": to_number(net_income.get("val") if net_income else None),
    "operating_income": to_number(operating_income.get("val") if operating_income else None),
    "total_liabilities": to_number(liabilities.get("val") if liabilities else None),
    "shares_outstanding": to_number(shares.get("val") if shares else None),
    "bsns_year": str(anchor.get("fy")) if anchor and anchor.get("fy") else None,
    "report_code": str(anchor.get("form")) if anchor and anchor.get("form") else None,
    "source": f"sec_companyfacts/{taxonomy}/{cik}",
  }


def build_metric_row(company: dict[str, Any]) -> tuple[Any, ...]:
  country = str(company["country"])
  code = str(company["code"])
  name = str(company["name"])
  currency = str(company.get("currency") or ("KRW" if country == "KR" else "USD"))

  if country == "KR":
    quote = fetch_kr_quote(code)
    financials = fetch_dart_financials(company)
    price = quote.get("price")
    shares = quote.get("shares")
    market_cap = quote.get("market_cap")
  else:
    quote = fetch_stooq_quote(code)
    financials = fetch_sec_financials(company)
    price = quote.get("price")
    shares = financials.get("shares_outstanding")
    share_source = "sec_companyfacts"
    share_ratio = ADR_SHARE_RATIO.get(code, 1.0)
    if shares is None or share_ratio != 1.0:
      try:
        yahoo_shares = fetch_yahoo_shares(code)
      except Exception:
        yahoo_shares = None
      if yahoo_shares is not None:
        shares = yahoo_shares
        share_source = "yahoo_timeseries"
    if shares is not None and share_ratio != 1.0 and share_source != "yahoo_timeseries":
      shares = shares / share_ratio
      share_source = f"sec_companyfacts/adr_ratio_{share_ratio:g}"
    market_cap = price * shares if price is not None and shares is not None else None

  equity = financials.get("equity")
  net_income = financials.get("net_income")
  operating_income = financials.get("operating_income")
  total_liabilities = financials.get("total_liabilities")
  per = safe_div(market_cap, net_income)
  pbr = safe_div(market_cap, equity)
  roe_raw = safe_div(net_income, equity)
  debt_raw = safe_div(total_liabilities, equity)

  if all(value is None for value in [market_cap, equity, net_income, per, pbr, roe_raw]):
    raise RuntimeError("no usable metric values collected")

  source = {
    "market": "daum" if country == "KR" else "stooq",
    "financials": financials.get("source"),
  }
  if country == "KR" and shares is not None:
    source["shares"] = "daum"
  if country == "US":
    source["shares"] = share_source
  if country == "US" and ADR_SHARE_RATIO.get(code):
    source["adr_share_ratio"] = ADR_SHARE_RATIO[code]

  return (
    today_text(),
    code,
    country,
    name,
    currency,
    price,
    market_cap,
    shares,
    equity,
    net_income,
    operating_income,
    total_liabilities,
    debt_raw * 100 if debt_raw is not None else None,
    None,
    None,
    per,
    pbr,
    roe_raw * 100 if roe_raw is not None else None,
    financials.get("report_code"),
    financials.get("bsns_year"),
    json.dumps(source, ensure_ascii=False),
    now_text(),
  )


def flush(metric_rows: list[tuple[Any, ...]], item_rows: list[tuple[Any, ...]]) -> None:
  if metric_rows:
    execute_many(
      """INSERT INTO metrics_history
         (snapshot_date, code, country, name, currency, close_price, market_cap,
          shares_outstanding, equity, net_income, operating_income,
          total_liabilities, debt_ratio, foreign_ratio, institution_ratio,
          per, pbr, roe, report_code, bsns_year, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(snapshot_date, code, country) DO UPDATE SET
           name = excluded.name,
           currency = excluded.currency,
           close_price = excluded.close_price,
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
  parser.add_argument("--market", choices=["KR", "US"], required=True)
  parser.add_argument("--shard-index", type=int, default=0)
  parser.add_argument("--shard-count", type=int, default=1)
  parser.add_argument("--codes", help="Comma-separated stock codes to process, bypassing shard filter")
  parser.add_argument(
    "--selection",
    choices=["all", "missing", "existing"],
    default="all",
    help="all companies, companies without metrics, or companies already having metrics",
  )
  parser.add_argument("--limit", type=int)
  parser.add_argument("--dry-run", action="store_true")
  args = parser.parse_args()

  if args.shard_count < 1:
    raise ValueError("--shard-count must be at least 1")
  if args.shard_index < 0 or args.shard_index >= args.shard_count:
    raise ValueError("--shard-index must be between 0 and shard-count - 1")

  all_companies = load_companies(args.market)
  if args.codes:
    requested_codes = [
      normalize_code(part, args.market)
      for part in args.codes.split(",")
      if part.strip()
    ]
    requested_set = set(requested_codes)
    order = {code: index for index, code in enumerate(requested_codes)}
    companies = [
      company
      for company in all_companies
      if normalize_code(str(company["code"]), args.market) in requested_set
    ]
    companies.sort(key=lambda company: order.get(normalize_code(str(company["code"]), args.market), 9999))
    found = {normalize_code(str(company["code"]), args.market) for company in companies}
    missing = [code for code in requested_codes if code not in found]
    if missing:
      print(f"Warning: missing companies in DB: {', '.join(missing)}")
  else:
    companies = [
      company
      for company in all_companies
      if in_shard(str(company["code"]), str(company["country"]), args.shard_index, args.shard_count)
    ]

  if args.selection != "all":
    metric_keys = load_metric_keys(args.market)
    if args.selection == "missing":
      companies = [
        company
        for company in companies
        if (str(company["code"]), str(company["country"])) not in metric_keys
      ]
    elif args.selection == "existing":
      companies = [
          company
          for company in companies
          if (str(company["code"]), str(company["country"])) in metric_keys
      ]

  if args.market == "US":
    companies = hydrate_us_ciks(companies, persist=not args.dry_run)
    if not args.codes:
      companies = [company for company in companies if company.get("cik")]

  if args.limit:
    companies = companies[: args.limit]

  run_id = str(uuid.uuid4())
  if not args.dry_run:
    execute(
      """INSERT INTO batch_runs
         (id, job_name, market, shard_index, shard_count, status, started_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?)""",
      [run_id, "update_metrics", args.market, args.shard_index, args.shard_count, now_text()],
    )

  processed = 0
  succeeded = 0
  failed = 0
  error_sample: list[str] = []
  metric_rows: list[tuple[Any, ...]] = []
  item_rows: list[tuple[Any, ...]] = []

  try:
    for company in companies:
      processed += 1
      code = str(company["code"])
      country = str(company["country"])
      try:
        row = build_metric_row(company)
        succeeded += 1
        if args.dry_run:
          print(f"[OK] {country}:{code} {company['name']}")
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
        if args.market == "US":
          time.sleep(0.15)
        elif args.market == "KR":
          time.sleep(0.05)

      if not args.dry_run and (len(metric_rows) >= 300 or len(item_rows) >= 300):
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
