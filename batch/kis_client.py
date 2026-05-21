import os
import time
from typing import Any

import requests

KIS_PROD_BASE_URL = "https://openapi.koreainvestment.com:9443"
KIS_DEMO_BASE_URL = "https://openapivts.koreainvestment.com:29443"

_TOKEN: str | None = None
_TOKEN_EXPIRES_AT = 0.0
_LAST_REQUEST_AT = 0.0


class KISConfigError(RuntimeError):
  pass


def to_number(value: Any) -> float | None:
  if value is None:
    return None
  if isinstance(value, (int, float)):
    return float(value)
  text = str(value).strip().replace(",", "")
  if not text or text.upper() in {"N/A", "NAN", "NULL", "-"}:
    return None
  try:
    return float(text)
  except ValueError:
    return None


def is_configured() -> bool:
  return bool(os.environ.get("KIS_APP_KEY") and os.environ.get("KIS_APP_SECRET"))


def env_name() -> str:
  value = (os.environ.get("KIS_ENV") or "real").strip().lower()
  return "demo" if value in {"demo", "vps", "paper"} else "real"


def base_url() -> str:
  custom = (os.environ.get("KIS_BASE_URL") or "").strip()
  if custom:
    return custom.rstrip("/")
  return KIS_DEMO_BASE_URL if env_name() == "demo" else KIS_PROD_BASE_URL


def request_delay() -> float:
  raw = (os.environ.get("KIS_REQUEST_DELAY_SECONDS") or "0.12").strip()
  try:
    return max(0.0, float(raw))
  except ValueError:
    return 0.12


def throttle() -> None:
  global _LAST_REQUEST_AT
  delay = request_delay()
  elapsed = time.time() - _LAST_REQUEST_AT
  if elapsed < delay:
    time.sleep(delay - elapsed)
  _LAST_REQUEST_AT = time.time()


def first_number(row: dict[str, Any], keys: list[str]) -> float | None:
  for key in keys:
    value = to_number(row.get(key))
    if value is not None:
      return value
  return None


def get_access_token() -> str:
  global _TOKEN, _TOKEN_EXPIRES_AT

  if not is_configured():
    raise KISConfigError("KIS_APP_KEY and KIS_APP_SECRET are not set")
  if _TOKEN and time.time() < _TOKEN_EXPIRES_AT:
    return _TOKEN

  throttle()
  response = requests.post(
    f"{base_url()}/oauth2/tokenP",
    headers={
      "Content-Type": "application/json",
      "Accept": "application/json",
      "charset": "UTF-8",
    },
    json={
      "grant_type": "client_credentials",
      "appkey": os.environ["KIS_APP_KEY"].strip(),
      "appsecret": os.environ["KIS_APP_SECRET"].strip(),
    },
    timeout=20,
  )
  response.raise_for_status()
  data = response.json()
  token = data.get("access_token")
  if not token:
    raise RuntimeError(f"KIS token response missing access_token: {data}")

  expires_in = int(to_number(data.get("expires_in")) or 86_400)
  _TOKEN = str(token)
  _TOKEN_EXPIRES_AT = time.time() + max(60, expires_in - 300)
  return _TOKEN


def request_get(path: str, tr_id: str, params: dict[str, str]) -> dict[str, Any]:
  token = get_access_token()
  throttle()
  response = requests.get(
    f"{base_url()}{path}",
    headers={
      "Authorization": f"Bearer {token}",
      "appkey": os.environ["KIS_APP_KEY"].strip(),
      "appsecret": os.environ["KIS_APP_SECRET"].strip(),
      "tr_id": tr_id,
      "custtype": (os.environ.get("KIS_CUSTTYPE") or "P").strip() or "P",
      "Content-Type": "application/json",
    },
    params=params,
    timeout=20,
  )
  response.raise_for_status()
  data = response.json()
  if str(data.get("rt_cd", "0")) != "0":
    raise RuntimeError(
      f"KIS API error {data.get('msg_cd')}: {data.get('msg1') or data}"
    )
  output = data.get("output")
  if isinstance(output, list):
    return output[0] if output else {}
  return output if isinstance(output, dict) else {}


def price_change_rate(price: float | None, previous_close: float | None) -> float | None:
  if price is None or previous_close in (None, 0):
    return None
  return (price - previous_close) / previous_close * 100


def fetch_domestic_quote(code: str) -> dict[str, Any]:
  row = request_get(
    "/uapi/domestic-stock/v1/quotations/inquire-price",
    "FHKST01010100",
    {
      "FID_COND_MRKT_DIV_CODE": (os.environ.get("KIS_KR_MARKET_DIV_CODE") or "J"),
      "FID_INPUT_ISCD": code,
    },
  )
  price = first_number(row, ["stck_prpr"])
  change = first_number(row, ["prdy_vrss"])
  previous_close = first_number(
    row,
    ["stck_prdy_clpr", "prdy_clpr", "stck_sdpr"],
  )
  if previous_close is None and price is not None and change is not None:
    previous_close = price - change
  change_rate = first_number(row, ["prdy_ctrt"]) or price_change_rate(
    price, previous_close
  )
  shares = first_number(row, ["lstn_stcn", "lstn_stk_num"])
  market_cap = price * shares if price is not None and shares is not None else None
  if market_cap is None:
    hts_market_cap = first_number(row, ["hts_avls", "avls"])
    if hts_market_cap is not None:
      market_cap = hts_market_cap * 100_000_000

  return {
    "price": price,
    "previous_close": previous_close,
    "change_rate": change_rate,
    "market_cap": market_cap,
    "shares": shares,
    "volume": first_number(row, ["acml_vol"]),
    "source": "kis",
    "raw_market": row.get("rprs_mrkt_kor_name"),
  }


def overseas_exchange_code(market: str | None) -> str:
  normalized = (market or "").strip().upper().replace(" ", "")
  mapping = {
    "NASDAQ": "NAS",
    "NAS": "NAS",
    "NASD": "NAS",
    "NYSE": "NYS",
    "NYS": "NYS",
    "NEWYORK": "NYS",
    "AMEX": "AMS",
    "AMERICAN": "AMS",
    "AMS": "AMS",
    "ARCA": "AMS",
  }
  return mapping.get(normalized, (os.environ.get("KIS_DEFAULT_US_EXCHANGE") or "NAS"))


def fetch_overseas_quote(symbol: str, market: str | None = None) -> dict[str, Any]:
  row = request_get(
    "/uapi/overseas-price/v1/quotations/price",
    "HHDFS00000300",
    {
      "AUTH": "",
      "EXCD": overseas_exchange_code(market),
      "SYMB": symbol,
    },
  )
  price = first_number(row, ["last", "ovrs_nmix_prpr", "stck_prpr"])
  previous_close = first_number(
    row,
    ["base", "stck_prdy_clpr", "prdy_clpr", "ovrs_stck_prdy_clpr"],
  )
  change = first_number(row, ["diff", "prdy_vrss", "ovrs_prdy_vrss"])
  if previous_close is None and price is not None and change is not None:
    previous_close = price - change
  change_rate = first_number(row, ["rate", "prdy_ctrt"]) or price_change_rate(
    price, previous_close
  )

  return {
    "price": price,
    "previous_close": previous_close,
    "change_rate": change_rate,
    "market_cap": None,
    "shares": None,
    "volume": first_number(row, ["tvol", "acml_vol"]),
    "source": "kis",
    "exchange": row.get("excd") or overseas_exchange_code(market),
  }


def fetch_kis_quote(country: str, code: str, market: str | None = None) -> dict[str, Any]:
  if country == "KR":
    return fetch_domestic_quote(code)
  if country == "US":
    return fetch_overseas_quote(code, market)
  raise ValueError(f"Unsupported KIS market country: {country}")
