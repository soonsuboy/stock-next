from __future__ import annotations

import re
from typing import Any

GICS_SECTORS = [
  "정보기술",
  "헬스케어",
  "경기소비재",
  "필수소비재",
  "금융",
  "커뮤니케이션",
  "산업재",
  "소재",
  "에너지",
  "유틸리티",
  "부동산",
]

KRX_INDUSTRY_TO_GICS = {
  "전기전자": "정보기술",
  "의료정밀": "헬스케어",
  "의약품": "헬스케어",
  "운수장비": "경기소비재",
  "유통업": "경기소비재",
  "섬유의복": "경기소비재",
  "음식료품": "필수소비재",
  "금융업": "금융",
  "보험": "금융",
  "증권": "금융",
  "통신업": "커뮤니케이션",
  "서비스업": "커뮤니케이션",
  "기계": "산업재",
  "운수창고": "산업재",
  "건설업": "산업재",
  "화학": "소재",
  "철강금속": "소재",
  "비금속광물": "소재",
  "전기가스업": "유틸리티",
  "부동산": "부동산",
}

US_INDUSTRY_TO_GICS = {
  "Information Technology": "정보기술",
  "Semiconductors": "정보기술",
  "Software": "정보기술",
  "Hardware": "정보기술",
  "Health Care": "헬스케어",
  "Biotechnology": "헬스케어",
  "Pharmaceuticals": "헬스케어",
  "Consumer Discretionary": "경기소비재",
  "Automobiles": "경기소비재",
  "Retail": "경기소비재",
  "Consumer Staples": "필수소비재",
  "Food": "필수소비재",
  "Beverages": "필수소비재",
  "Financials": "금융",
  "Banks": "금융",
  "Insurance": "금융",
  "Communication Services": "커뮤니케이션",
  "Media": "커뮤니케이션",
  "Entertainment": "커뮤니케이션",
  "Industrials": "산업재",
  "Aerospace": "산업재",
  "Machinery": "산업재",
  "Materials": "소재",
  "Chemicals": "소재",
  "Metals": "소재",
  "Energy": "에너지",
  "Oil": "에너지",
  "Utilities": "유틸리티",
  "Real Estate": "부동산",
  "REIT": "부동산",
}

KR_CODE_TO_GICS = {
  "005930": "정보기술",
  "000660": "정보기술",
  "035420": "커뮤니케이션",
  "035720": "커뮤니케이션",
  "207940": "헬스케어",
  "068270": "헬스케어",
  "005380": "경기소비재",
  "000270": "경기소비재",
  "055550": "금융",
  "105560": "금융",
  "051910": "소재",
  "096770": "에너지",
  "015760": "유틸리티",
}

US_SYMBOL_TO_GICS = {
  "AAPL": "정보기술",
  "MSFT": "정보기술",
  "NVDA": "정보기술",
  "AVGO": "정보기술",
  "AMD": "정보기술",
  "TSM": "정보기술",
  "GOOGL": "커뮤니케이션",
  "GOOG": "커뮤니케이션",
  "META": "커뮤니케이션",
  "NFLX": "커뮤니케이션",
  "AMZN": "경기소비재",
  "TSLA": "경기소비재",
  "HD": "경기소비재",
  "MCD": "경기소비재",
  "WMT": "필수소비재",
  "COST": "필수소비재",
  "PG": "필수소비재",
  "KO": "필수소비재",
  "PEP": "필수소비재",
  "JPM": "금융",
  "BAC": "금융",
  "BRK-B": "금융",
  "V": "금융",
  "MA": "금융",
  "LLY": "헬스케어",
  "UNH": "헬스케어",
  "JNJ": "헬스케어",
  "MRK": "헬스케어",
  "XOM": "에너지",
  "CVX": "에너지",
  "LIN": "소재",
  "CAT": "산업재",
  "GE": "산업재",
  "NEE": "유틸리티",
  "PLD": "부동산",
}

NAME_KEYWORDS: list[tuple[re.Pattern[str], str]] = [
  (re.compile(r"semiconductor|software|technology|systems|data|cloud|chip|반도체|전자|소프트웨어|테크", re.I), "정보기술"),
  (re.compile(r"pharma|bio|health|medical|therapeutics|병원|제약|바이오|헬스케어", re.I), "헬스케어"),
  (re.compile(r"auto|motor|vehicle|apparel|hotel|travel|restaurant|자동차|모빌리티|호텔|여행|백화점", re.I), "경기소비재"),
  (re.compile(r"food|beverage|consumer|grocery|tobacco|식품|음료|생활용품|화장품", re.I), "필수소비재"),
  (re.compile(r"bank|financial|capital|insurance|asset|securities|은행|금융|증권|보험|카드", re.I), "금융"),
  (re.compile(r"communication|telecom|media|entertainment|interactive|platform|통신|미디어|엔터|게임|플랫폼", re.I), "커뮤니케이션"),
  (re.compile(r"industrial|aerospace|machinery|logistics|construction|건설|기계|항공|물류|조선", re.I), "산업재"),
  (re.compile(r"chemical|materials|steel|metal|mining|화학|소재|철강|금속", re.I), "소재"),
  (re.compile(r"energy|oil|gas|petroleum|refining|에너지|정유|가스|석유", re.I), "에너지"),
  (re.compile(r"utilities|utility|electric|power|water|전력|전기|가스공사|수자원", re.I), "유틸리티"),
  (re.compile(r"reit|real estate|property|부동산|리츠", re.I), "부동산"),
]


def normalize_sector(value: Any) -> str | None:
  text = str(value or "").strip()
  return text if text in GICS_SECTORS else None


def infer_gics_sector(
  *,
  code: str,
  country: str,
  name: str,
  market: str | None = None,
  industry_name: str | None = None,
) -> tuple[str | None, str | None]:
  country = country.upper()
  normalized_code = code.upper().replace(".", "-")

  if country == "KR":
    sector = KR_CODE_TO_GICS.get(normalized_code.zfill(6))
    if sector:
      return sector, "kr_code_override"

  if country == "US":
    sector = US_SYMBOL_TO_GICS.get(normalized_code)
    if sector:
      return sector, "us_symbol_override"

  industry = (industry_name or market or "").strip()
  if industry:
    source_map = KRX_INDUSTRY_TO_GICS if country == "KR" else US_INDUSTRY_TO_GICS
    sector = source_map.get(industry)
    if sector:
      return sector, "industry_exact"
    lower = industry.lower()
    for keyword, value in source_map.items():
      if keyword.lower() in lower:
        return value, "industry_keyword"

  for pattern, sector in NAME_KEYWORDS:
    if pattern.search(name or ""):
      return sector, "name_keyword"

  return None, None
