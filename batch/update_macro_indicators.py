import argparse
import csv
import json
import math
import os
import re
from datetime import date, datetime
from io import BytesIO, StringIO
from typing import Any
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from db import execute, execute_many

KST = ZoneInfo("Asia/Seoul")
UA = "Mozilla/5.0 (compatible; soonsuboy-stock-next/1.0)"
KRW_UNIT_EOK = 100_000_000
KRW_UNIT_MILLION = 1_000_000
FALLBACK_DEPOSIT_KRW = 130_000_000_000_000
FALLBACK_CREDIT_KRW = 38_000_000_000_000
ECOS_BASE_URL = "https://ecos.bok.or.kr/api"
FX_DAILY_BASE_URL = "https://ksureapi.einfomax.co.kr/v2/datafeed/ksure/fxfiledown"
FX_DAILY_BASE_DATE = date(2026, 6, 4)
FX_DAILY_BASE_ID = 3657
FX_VOLUME_SURGE_EOK_USD = 150
USD_UNIT_EOK = 100_000_000


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


def usd_eok_display(value: float | None) -> str:
  if value is None:
    return "-"
  sign = "-" if value < 0 else ""
  amount = abs(value) / USD_UNIT_EOK
  return f"{sign}{amount:,.2f}억달러"


def percent_display(value: float | None) -> str:
  if value is None:
    return "-"
  sign = "+" if value > 0 else ""
  return f"{sign}{value:.2f}%"


def net_buy_display(value: float | None) -> str:
  if value is None:
    return "-"
  direction = "순매수" if value >= 0 else "순매도"
  return f"{krw_display(value)} {direction}"


def net_buy_change_display(value: float | None) -> str:
  if value is None:
    return "-"
  if value == 0:
    return "변동 없음"
  direction = "매수 방향" if value > 0 else "매도 방향"
  return f"{krw_display(value)} {direction}"


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


def ecos_api_key() -> str:
  return os.environ.get("BOK_API_KEY") or os.environ.get("ECOS_API_KEY") or "sample"


def ecos_source_name() -> str:
  return "bok_ecos" if ecos_api_key() != "sample" else "bok_ecos_sample"


def ecos_search_rows(
  stat_code: str,
  cycle: str,
  start: str,
  end: str,
  item_code: str,
  limit: int = 10,
) -> list[dict[str, Any]]:
  key = ecos_api_key()
  url = (
    f"{ECOS_BASE_URL}/StatisticSearch/{key}/json/kr/1/{limit}/"
    f"{stat_code}/{cycle}/{start}/{end}/{item_code}"
  )
  response = requests.get(url, headers={"User-Agent": UA}, timeout=20)
  response.raise_for_status()
  data = response.json()
  if "RESULT" in data:
    result = data["RESULT"]
    raise RuntimeError(f"ECOS {result.get('CODE')}: {result.get('MESSAGE')}")
  rows = data.get("StatisticSearch", {}).get("row") or []
  if not isinstance(rows, list):
    raise RuntimeError("ECOS response rows missing")
  return rows


def month_text(months_ago: int = 0) -> str:
  today = datetime.now(KST).date()
  month_index = today.year * 12 + today.month - 1 - months_ago
  year = month_index // 12
  month = month_index % 12 + 1
  return f"{year:04d}{month:02d}"


def monthly_snapshot_date(yyyymm: str) -> str:
  if len(yyyymm) != 6:
    return today_text()
  return f"{yyyymm[:4]}-{yyyymm[4:]}-01"


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


def business_days_between(start: date, end: date) -> int:
  step = 1 if end >= start else -1
  current = start
  count = 0
  while current != end:
    current = date.fromordinal(current.toordinal() + step)
    if current.weekday() < 5:
      count += step
  return count


def estimated_fx_daily_id() -> int:
  today = datetime.now(KST).date()
  return FX_DAILY_BASE_ID + business_days_between(FX_DAILY_BASE_DATE, today)


def extract_fx_daily_pdf(pdf_bytes: bytes) -> tuple[str | None, float | None]:
  from pypdf import PdfReader

  reader = PdfReader(BytesIO(pdf_bytes))
  text = "\n".join(page.extract_text() or "" for page in reader.pages)
  if not text.strip():
    return None, None

  date_match = re.search(r"FX\s*M\s*arket\s*Daily\s+(\d{4}-\d{2}-\d{2})", text)
  volume_match = re.search(
    r"현물환\s*거래량\s*\(\s*종합\s*\)\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*억달러",
    text,
    re.S,
  )
  if not volume_match:
    volume_match = re.search(
      r"현물환\s*거래량.*?([0-9]+(?:\.[0-9]+)?)\s*억달러",
      text,
      re.S,
    )
  volume_eok_usd = parse_number(volume_match.group(1)) if volume_match else None
  return date_match.group(1) if date_match else None, volume_eok_usd


def fetch_seoul_fx_usd_volume() -> dict[str, Any]:
  start_id = int(os.environ.get("KSURE_FX_DAILY_START_ID") or estimated_fx_daily_id() + 5)
  scan_window = int(os.environ.get("KSURE_FX_DAILY_SCAN_WINDOW") or 45)
  last_error: Exception | None = None

  with requests.Session() as session:
    session.headers.update({"User-Agent": UA})
    for report_id in range(start_id, start_id - scan_window, -1):
      if report_id <= 0:
        break
      try:
        response = session.get(f"{FX_DAILY_BASE_URL}/{report_id}", timeout=20)
        response.raise_for_status()
        if not response.content.startswith(b"%PDF"):
          continue
        report_date, volume_eok_usd = extract_fx_daily_pdf(response.content)
        if not report_date or volume_eok_usd is None:
          continue

        value = volume_eok_usd * USD_UNIT_EOK
        status = "surge" if volume_eok_usd >= FX_VOLUME_SURGE_EOK_USD else "ok"
        return {
          "snapshot_date": report_date,
          "indicator_key": "seoul_fx_usd_volume",
          "region": "KR",
          "label": "서울외환시장 달러 거래량",
          "value": value,
          "unit": "USD",
          "display_value": usd_eok_display(value),
          "source": "ksure_einfomax_fx_daily",
          "status": status,
          "note": (
            f"FX Market Daily #{report_id} 전일 현물환 거래량(종합). "
            f"{FX_VOLUME_SURGE_EOK_USD:.0f}억달러 이상이면 평시 100~130억달러를 크게 상회한 것으로 표시"
          ),
        }
      except Exception as error:
        last_error = error

  raise RuntimeError(f"FX Market Daily volume not found: {last_error}")


def fetch_fx_reserves() -> list[dict[str, Any]]:
  rows = ecos_search_rows(
    "732Y001",
    "M",
    month_text(9),
    month_text(0),
    "99",
    limit=10,
  )
  parsed: list[tuple[str, float]] = []
  for row in rows:
    period = str(row.get("TIME") or "")
    value_thousand_usd = parse_number(row.get("DATA_VALUE"))
    if len(period) == 6 and value_thousand_usd is not None:
      parsed.append((period, value_thousand_usd * 1000))
  parsed.sort(key=lambda item: item[0])
  if len(parsed) < 2:
    raise RuntimeError("ECOS foreign reserves rows need at least two months")

  latest_period, latest_value = parsed[-1]
  previous_period, previous_value = parsed[-2]
  change_value = latest_value - previous_value
  change_rate = change_value / previous_value * 100 if previous_value else None
  snapshot_date = monthly_snapshot_date(latest_period)
  comparison_note = f"{latest_period[:4]}-{latest_period[4:]} 월말 기준, 전월 {previous_period[:4]}-{previous_period[4:]} 대비"
  source = ecos_source_name()

  return [
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "fx_reserves_total",
      "region": "KR",
      "label": "외환보유액",
      "value": latest_value,
      "unit": "USD",
      "display_value": usd_eok_display(latest_value),
      "source": source,
      "status": "ok",
      "note": f"한국은행 ECOS 732Y001 합계. {comparison_note}",
    },
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "fx_reserves_mom_change",
      "region": "KR",
      "label": "외환보유액 전월대비",
      "value": change_value,
      "unit": "USD",
      "display_value": usd_eok_display(change_value),
      "source": "derived",
      "status": "down" if change_value < 0 else "ok",
      "note": comparison_note,
    },
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "fx_reserves_mom_rate",
      "region": "KR",
      "label": "외환보유액 전월대비율",
      "value": change_rate,
      "unit": "PERCENT",
      "display_value": percent_display(change_rate),
      "source": "derived",
      "status": "down" if change_rate is not None and change_rate < 0 else "ok",
      "note": comparison_note,
    },
  ]


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


def fetch_investor_deal_rows(sosok: str, market_label: str) -> list[dict[str, Any]]:
  bizdate = datetime.now(KST).strftime("%Y%m%d")
  html = request_text(
    f"https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate={bizdate}&sosok={sosok}&page=1",
    "euc-kr",
  )
  soup = BeautifulSoup(html, "html.parser")
  rows: list[dict[str, Any]] = []
  for tr in soup.select("tr"):
    cells = [cell.get_text(" ", strip=True) for cell in tr.select("td")]
    if len(cells) < 3 or not cells[0] or "." not in cells[0]:
      continue
    foreign_eok = parse_number(cells[2])
    if foreign_eok is None:
      continue
    rows.append(
      {
        "market": market_label,
        "snapshot_date": parse_yy_mm_dd(cells[0]),
        "foreign_krw": foreign_eok * KRW_UNIT_EOK,
      }
    )
    if len(rows) >= 2:
      break
  if len(rows) < 2:
    raise RuntimeError(f"{market_label} foreign investor rows not found")
  return rows


def fetch_market_trade_value(market_code: str, market_label: str) -> float:
  html = request_text(
    f"https://finance.naver.com/sise/sise_index.naver?code={market_code}",
    "euc-kr",
  )
  soup = BeautifulSoup(html, "html.parser")
  for th in soup.select("th"):
    if "거래대금" not in th.get_text(" ", strip=True):
      continue
    td = th.find_next_sibling("td")
    value_million = parse_number(td.get_text(" ", strip=True) if td else None)
    if value_million is not None:
      return value_million * KRW_UNIT_MILLION
  raise RuntimeError(f"{market_label} trade value not found")


def fetch_kr_market_foreign_flow() -> list[dict[str, Any]]:
  markets = [
    {"code": "KOSPI", "sosok": "01", "label": "코스피"},
    {"code": "KOSDAQ", "sosok": "02", "label": "코스닥"},
  ]
  latest_net = 0.0
  previous_net = 0.0
  total_trade_value = 0.0
  latest_dates: list[str] = []
  previous_dates: list[str] = []
  parts: list[str] = []

  for market in markets:
    rows = fetch_investor_deal_rows(market["sosok"], market["label"])
    trade_value = fetch_market_trade_value(market["code"], market["label"])
    latest_net += rows[0]["foreign_krw"]
    previous_net += rows[1]["foreign_krw"]
    total_trade_value += trade_value
    latest_dates.append(str(rows[0]["snapshot_date"]))
    previous_dates.append(str(rows[1]["snapshot_date"]))
    parts.append(
      f"{market['label']} {net_buy_display(rows[0]['foreign_krw'])}, 거래대금 {krw_display(trade_value)}"
    )

  snapshot_date = max(latest_dates) if latest_dates else today_text()
  previous_date = max(previous_dates) if previous_dates else ""
  ratio = latest_net / total_trade_value * 100 if total_trade_value else None
  change = latest_net - previous_net
  status = "net_buy" if latest_net >= 0 else "net_sell"
  change_status = "net_buy" if change >= 0 else "net_sell"
  direction = "순매수" if latest_net >= 0 else "순매도"
  note = (
    "국내시장 전체=코스피+코스닥. "
    "비율=외국인 순매수액/코스피+코스닥 거래대금. "
    f"전일 비교 기준일 {previous_date}. "
    + " / ".join(parts)
  )

  return [
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "kr_market_foreign_net_buy",
      "region": "KR",
      "label": "국내시장 외국인 순매수",
      "value": latest_net,
      "unit": "KRW",
      "display_value": net_buy_display(latest_net),
      "source": "naver_finance",
      "status": status,
      "note": note,
    },
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "kr_market_foreign_net_buy_ratio",
      "region": "KR",
      "label": "외국인 순매수 비율",
      "value": ratio,
      "unit": "PERCENT",
      "display_value": "-" if ratio is None else f"{percent_display(ratio)} ({direction})",
      "source": "derived",
      "status": status,
      "note": note,
    },
    {
      "snapshot_date": snapshot_date,
      "indicator_key": "kr_market_foreign_net_buy_change",
      "region": "KR",
      "label": "외국인 순매수 전일대비",
      "value": change,
      "unit": "KRW",
      "display_value": net_buy_change_display(change),
      "source": "derived",
      "status": change_status,
      "note": note,
    },
  ]


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
      "앱 자체 산출: 신용융자/예탁금 비율 60%, 국내시장 외국인 순매수 40%"
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

  try:
    indicators.append(fetch_seoul_fx_usd_volume())
  except Exception as error:
    indicators.append(
      error_indicator("seoul_fx_usd_volume", "KR", "서울외환시장 달러 거래량", error)
    )

  try:
    indicators.extend(fetch_fx_reserves())
  except Exception as error:
    indicators.extend(
      [
        error_indicator("fx_reserves_total", "KR", "외환보유액", error),
        error_indicator("fx_reserves_mom_change", "KR", "외환보유액 전월대비", error),
        error_indicator("fx_reserves_mom_rate", "KR", "외환보유액 전월대비율", error),
      ]
    )

  foreign: dict[str, Any] | None = None
  try:
    kr_market_foreign = fetch_kr_market_foreign_flow()
    indicators.extend(kr_market_foreign)
    foreign = kr_market_foreign[0]
  except Exception as error:
    indicators.extend(
      [
        error_indicator("kr_market_foreign_net_buy", "KR", "국내시장 외국인 순매수", error),
        error_indicator("kr_market_foreign_net_buy_ratio", "KR", "외국인 순매수 비율", error),
        error_indicator(
          "kr_market_foreign_net_buy_change",
          "KR",
          "외국인 순매수 전일대비",
          error,
        ),
      ]
    )

  try:
    indicators.append(fetch_kospi_foreign_net_buy())
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


def update_batch_run_started(run_id: str) -> None:
  execute(
    """UPDATE batch_runs
       SET status = 'running',
           started_at = COALESCE(started_at, ?),
           completed_at = NULL,
           processed = 0,
           succeeded = 0,
           failed = 0
       WHERE id = ?""",
    [now_text(), run_id],
  )


def update_batch_run_success(run_id: str, indicators: list[dict[str, Any]]) -> None:
  failed = sum(1 for item in indicators if item.get("status") == "error")
  processed = len(indicators)
  succeeded = processed - failed
  status = "success" if failed == 0 else "partial"
  error_sample = " / ".join(
    f"{item.get('label')}: {item.get('note')}"
    for item in indicators
    if item.get("status") == "error"
  )[:1000] or None
  execute(
    """UPDATE batch_runs
       SET status = ?,
           completed_at = ?,
           processed = ?,
           succeeded = ?,
           failed = ?,
           error_sample = ?
       WHERE id = ?""",
    [status, now_text(), processed, succeeded, failed, error_sample, run_id],
  )


def update_batch_run_failed(run_id: str, error: Exception) -> None:
  execute(
    """UPDATE batch_runs
       SET status = 'failed',
           completed_at = ?,
           processed = 0,
           succeeded = 0,
           failed = 1,
           error_sample = ?
       WHERE id = ?""",
    [now_text(), str(error)[:1000], run_id],
  )


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--dry-run", action="store_true")
  parser.add_argument("--run-id")
  args = parser.parse_args()

  if args.run_id and not args.dry_run:
    update_batch_run_started(args.run_id)

  try:
    indicators = collect()
    if args.dry_run:
      for item in indicators:
        print(json.dumps(item, ensure_ascii=False))
    else:
      write_indicators(indicators)
      if args.run_id:
        update_batch_run_success(args.run_id, indicators)
      print(f"Done. macro indicators={len(indicators)}")
  except Exception as error:
    if args.run_id and not args.dry_run:
      update_batch_run_failed(args.run_id, error)
    raise


if __name__ == "__main__":
  main()
