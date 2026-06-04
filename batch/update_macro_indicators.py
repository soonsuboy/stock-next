import argparse
import csv
import json
import math
from datetime import datetime
from io import StringIO
from typing import Any
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from db import execute, execute_many

KST = ZoneInfo("Asia/Seoul")
UA = "Mozilla/5.0 (compatible; soonsuboy-stock-next/1.0)"
KRW_UNIT_EOK = 100_000_000
FALLBACK_DEPOSIT_KRW = 130_000_000_000_000
FALLBACK_CREDIT_KRW = 38_000_000_000_000


def now_text() -> str:
  return datetime.now(KST).isoformat(timespec="seconds")


def today_text() -> str:
  return datetime.now(KST).date().isoformat()


def parse_number(value: Any) -> float | None:
  if value is None:
    return None
  text = str(value).strip().replace(",", "")
  if not text or text in ["-", "N/D"]:
    return None
  try:
    return float(text)
  except ValueError:
    return None


def parse_yy_mm_dd(value: str) -> str:
  parts = value.strip().split(".")
  if len(parts) != 3:
    return today_text()
  year = int(parts[0])
  if year < 100:
    year += 2000
  return f"{year:04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"


def classify_score(score: float | None) -> str:
  if score is None:
    return "미수집"
  if score < 25:
    return "극단적 공포"
  if score < 45:
    return "공포"
  if score < 55:
    return "중립"
  if score < 75:
    return "탐욕"
  return "극단적 탐욕"


def krw_display(value: float | None) -> str:
  if value is None:
    return "-"
  sign = "-" if value < 0 else ""
  amount = abs(value)
  if amount >= 1_0000_0000_0000:
    return f"{sign}{amount / 1_0000_0000_0000:.2f}조원"
  if amount >= 100_000_000:
    return f"{sign}{amount / 100_000_000:.0f}억원"
  return f"{sign}{amount:,.0f}원"


def score_display(value: float | None, classification: str | None = None) -> str:
  if value is None:
    return "-"
  label = classification or classify_score(value)
  return f"{value:.0f} / 100 ({label})"


def request_text(url: str, encoding: str | None = None) -> str:
  response = requests.get(url, headers={"User-Agent": UA}, timeout=20)
  response.raise_for_status()
  if encoding:
    response.encoding = encoding
  return response.text


def fetch_usd_krw() -> dict[str, Any]:
  response = requests.get(
    "https://stooq.com/q/l/",
    params={"s": "usdkrw", "f": "sd2t2ohlcv", "h": "", "e": "csv"},
    headers={"User-Agent": UA},
    timeout=20,
  )
  response.raise_for_status()
  row = next(csv.DictReader(StringIO(response.text)), None)
  if not row:
    raise RuntimeError("USDKRW CSV row is empty")
  value = parse_number(row.get("Close"))
  if value is None:
    raise RuntimeError("USDKRW close is missing")
  snapshot_date = str(row.get("Date") or today_text())
  return {
    "snapshot_date": snapshot_date,
    "indicator_key": "usd_krw",
    "region": "GLOBAL",
    "label": "원/달러 환율",
    "value": value,
    "unit": "KRW_PER_USD",
    "display_value": f"{value:,.2f}원",
    "source": "stooq",
    "status": "ok",
    "note": "USDKRW close",
  }


def fetch_kospi_foreign_net_buy() -> dict[str, Any]:
  bizdate = datetime.now(KST).strftime("%Y%m%d")
  html = request_text(
    f"https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate={bizdate}&sosok=&page=1",
    "euc-kr",
  )
  soup = BeautifulSoup(html, "html.parser")
  for tr in soup.select("tr"):
    cells = [cell.get_text(" ", strip=True) for cell in tr.select("td")]
    if len(cells) < 3 or not cells[0] or "." not in cells[0]:
      continue
    foreign_eok = parse_number(cells[2])
    if foreign_eok is None:
      continue
    value = foreign_eok * KRW_UNIT_EOK
    direction = "순매수" if value >= 0 else "순매도"
    return {
      "snapshot_date": parse_yy_mm_dd(cells[0]),
      "indicator_key": "kospi_foreign_net_buy",
      "region": "KR",
      "label": "코스피 외국인 순매수",
      "value": value,
      "unit": "KRW",
      "display_value": f"{krw_display(value)} {direction}",
      "source": "naver_finance",
      "status": "ok",
      "note": "단위 원. Naver 일자별 순매수 표 원자료는 억원",
    }
  raise RuntimeError("KOSPI foreign investor row not found")


def fetch_deposit_and_credit() -> tuple[dict[str, Any], dict[str, Any]]:
  html = request_text("https://finance.naver.com/sise/sise_deposit.naver", "euc-kr")
  soup = BeautifulSoup(html, "html.parser")
  for tr in soup.select("table tr"):
    cells = [cell.get_text(" ", strip=True) for cell in tr.select("td")]
    if len(cells) < 4 or "." not in cells[0]:
      continue
    deposit_eok = parse_number(cells[1])
    credit_eok = parse_number(cells[3])
    if deposit_eok is None or credit_eok is None:
      continue
    snapshot_date = parse_yy_mm_dd(cells[0])
    deposit = deposit_eok * KRW_UNIT_EOK
    credit = credit_eok * KRW_UNIT_EOK
    return (
      {
        "snapshot_date": snapshot_date,
        "indicator_key": "investor_deposit_total",
        "region": "KR",
        "label": "투자자 총 예탁금",
        "value": deposit,
        "unit": "KRW",
        "display_value": krw_display(deposit),
        "source": "naver_finance",
        "status": "ok",
        "note": "Naver 증시자금동향 고객예탁금. 원자료 단위는 억원",
      },
      {
        "snapshot_date": snapshot_date,
        "indicator_key": "credit_loan_total",
        "region": "KR",
        "label": "신용거래융자 총액",
        "value": credit,
        "unit": "KRW",
        "display_value": krw_display(credit),
        "source": "naver_finance",
        "status": "ok",
        "note": "Naver 증시자금동향 신용잔고를 신용거래융자 대용값으로 표시",
      },
    )
  raise RuntimeError("Deposit and credit row not found")


def fallback_deposit_and_credit(error: Exception) -> tuple[dict[str, Any], dict[str, Any]]:
  snapshot_date = today_text()
  note = f"fallback: user-provided Gemini reference because source failed: {error}"
  return (
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "investor_deposit_total",
      "region": "KR",
      "label": "투자자 총 예탁금",
      "value": FALLBACK_DEPOSIT_KRW,
      "unit": "KRW",
      "display_value": krw_display(FALLBACK_DEPOSIT_KRW),
      "source": "manual_fallback",
      "status": "fallback",
      "note": note,
    },
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "credit_loan_total",
      "region": "KR",
      "label": "신용거래융자 총액",
      "value": FALLBACK_CREDIT_KRW,
      "unit": "KRW",
      "display_value": krw_display(FALLBACK_CREDIT_KRW),
      "source": "manual_fallback",
      "status": "fallback",
      "note": note,
    },
  )


def build_credit_ratio(deposit: dict[str, Any], credit: dict[str, Any]) -> dict[str, Any]:
  deposit_value = parse_number(deposit.get("value"))
  credit_value = parse_number(credit.get("value"))
  ratio = (
    credit_value / deposit_value * 100
    if deposit_value and credit_value is not None
    else None
  )
  status_label = "과열" if ratio is not None and ratio >= 30 else "정상"
  snapshot_date = str(deposit.get("snapshot_date") or credit.get("snapshot_date") or today_text())
  return {
    "snapshot_date": snapshot_date,
    "indicator_key": "credit_deposit_ratio",
    "region": "KR",
    "label": "예탁금 대비 신용융자 비율",
    "value": ratio,
    "unit": "PERCENT",
    "display_value": "-" if ratio is None else f"{ratio:.2f}% ({status_label})",
    "source": "derived",
    "status": "overheated" if status_label == "과열" else "ok",
    "note": "30% 이상이면 과열구간으로 표시",
  }


def build_korea_fear_greed(
  foreign: dict[str, Any] | None,
  ratio: dict[str, Any],
) -> dict[str, Any]:
  ratio_value = parse_number(ratio.get("value"))
  foreign_value = parse_number(foreign.get("value")) if foreign else None

  leverage_score = 50.0
  if ratio_value is not None:
    leverage_score = max(10, min(95, 20 + ratio_value * 2.0))

  foreign_score = 50.0
  if foreign_value is not None:
    foreign_eok = foreign_value / KRW_UNIT_EOK
    foreign_score = max(5, min(95, 50 + foreign_eok / 1500))

  score = round(leverage_score * 0.6 + foreign_score * 0.4)
  classification = classify_score(score)
  return {
    "snapshot_date": str(ratio.get("snapshot_date") or today_text()),
    "indicator_key": "fear_greed_kr",
    "region": "KR",
    "label": "국내 공포탐욕지수",
    "value": score,
    "unit": "SCORE",
    "display_value": score_display(score, classification),
    "source": "derived",
    "status": "ok",
    "note": (
      "앱 자체 산출: 신용융자/예탁금 비율 60%, 코스피 외국인 순매수 40%"
    ),
  }


def fetch_us_fear_greed() -> dict[str, Any]:
  response = requests.get(
    "https://feargreedchart.com/api/",
    params={"action": "all"},
    headers={"User-Agent": UA},
    timeout=20,
  )
  response.raise_for_status()
  data = response.json()
  value = parse_number((data.get("score") or {}).get("score"))
  if value is None:
    raise RuntimeError("US fear greed score missing")
  return {
    "snapshot_date": today_text(),
    "indicator_key": "fear_greed_us",
    "region": "US",
    "label": "미국 공포탐욕지수",
    "value": value,
    "unit": "SCORE",
    "display_value": score_display(value),
    "source": "feargreedchart",
    "status": "ok",
    "note": json.dumps((data.get("score") or {}).get("components") or [], ensure_ascii=False)[:1000],
  }


def fetch_btc_fear_greed() -> dict[str, Any]:
  response = requests.get(
    "https://api.alternative.me/fng/",
    params={"limit": "1", "format": "json"},
    headers={"User-Agent": UA},
    timeout=20,
  )
  response.raise_for_status()
  data = response.json()
  item = (data.get("data") or [None])[0]
  if not isinstance(item, dict):
    raise RuntimeError("BTC fear greed item missing")
  value = parse_number(item.get("value"))
  if value is None:
    raise RuntimeError("BTC fear greed value missing")
  classification = str(item.get("value_classification") or classify_score(value))
  timestamp = parse_number(item.get("timestamp"))
  snapshot_date = today_text()
  if timestamp and math.isfinite(timestamp):
    snapshot_date = datetime.fromtimestamp(timestamp, KST).date().isoformat()
  return {
    "snapshot_date": snapshot_date,
    "indicator_key": "fear_greed_btc",
    "region": "BTC",
    "label": "비트코인 공포탐욕지수",
    "value": value,
    "unit": "SCORE",
    "display_value": score_display(value, classification),
    "source": "alternative_me",
    "status": "ok",
    "note": classification,
  }


def error_indicator(indicator_key: str, region: str, label: str, error: Exception) -> dict[str, Any]:
  return {
    "snapshot_date": today_text(),
    "indicator_key": indicator_key,
    "region": region,
    "label": label,
    "value": None,
    "unit": "",
    "display_value": "-",
    "source": "unavailable",
    "status": "error",
    "note": str(error)[:1000],
  }


def collect() -> list[dict[str, Any]]:
  indicators: list[dict[str, Any]] = []

  try:
    indicators.append(fetch_usd_krw())
  except Exception as error:
    indicators.append(error_indicator("usd_krw", "GLOBAL", "원/달러 환율", error))

  foreign: dict[str, Any] | None = None
  try:
    foreign = fetch_kospi_foreign_net_buy()
    indicators.append(foreign)
  except Exception as error:
    indicators.append(
      error_indicator("kospi_foreign_net_buy", "KR", "코스피 외국인 순매수", error)
    )

  try:
    deposit, credit = fetch_deposit_and_credit()
  except Exception as error:
    deposit, credit = fallback_deposit_and_credit(error)
  indicators.extend([deposit, credit])

  ratio = build_credit_ratio(deposit, credit)
  indicators.append(ratio)
  indicators.append(build_korea_fear_greed(foreign, ratio))

  try:
    indicators.append(fetch_us_fear_greed())
  except Exception as error:
    indicators.append(error_indicator("fear_greed_us", "US", "미국 공포탐욕지수", error))

  try:
    indicators.append(fetch_btc_fear_greed())
  except Exception as error:
    indicators.append(
      error_indicator("fear_greed_btc", "BTC", "비트코인 공포탐욕지수", error)
    )

  return indicators


def write_indicators(indicators: list[dict[str, Any]]) -> None:
  execute(
    """CREATE TABLE IF NOT EXISTS macro_indicators (
         snapshot_date TEXT NOT NULL,
         indicator_key TEXT NOT NULL,
         region        TEXT NOT NULL,
         label         TEXT NOT NULL,
         value         REAL,
         unit          TEXT,
         display_value TEXT,
         source        TEXT,
         status        TEXT NOT NULL DEFAULT 'ok',
         note          TEXT,
         created_at    TEXT,
         PRIMARY KEY(snapshot_date, indicator_key)
       )"""
  )
  execute_many(
    """INSERT INTO macro_indicators
       (snapshot_date, indicator_key, region, label, value, unit, display_value,
        source, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(snapshot_date, indicator_key) DO UPDATE SET
         region = excluded.region,
         label = excluded.label,
         value = excluded.value,
         unit = excluded.unit,
         display_value = excluded.display_value,
         source = excluded.source,
         status = excluded.status,
         note = excluded.note,
         created_at = excluded.created_at""",
    [
      (
        item["snapshot_date"],
        item["indicator_key"],
        item["region"],
        item["label"],
        item.get("value"),
        item.get("unit"),
        item.get("display_value"),
        item.get("source"),
        item.get("status") or "ok",
        item.get("note"),
        now_text(),
      )
      for item in indicators
    ],
  )


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--dry-run", action="store_true")
  args = parser.parse_args()

  indicators = collect()
  if args.dry_run:
    for item in indicators:
      print(json.dumps(item, ensure_ascii=False))
  else:
    write_indicators(indicators)
    print(f"Done. macro indicators={len(indicators)}")


if __name__ == "__main__":
  main()
