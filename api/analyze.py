"""
GET /api/analyze?code=<code>
Returns full metrics for one stock: market cap, financials, PER/PBR/ROE.
"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib import markets, dart, yahoo


def safe_div(a, b):
    if a is None or b is None or b == 0:
        return None
    try:
        return a / b
    except Exception:
        return None


def analyze(code: str) -> dict:
    code = (code or "").strip()
    if not code:
        return {"ok": False, "error": "code is required"}

    # Decide country: 6-digit -> KR, else US
    is_kr = bool(re.fullmatch(r"\d{6}", code))
    country = "KR" if is_kr else "US"

    result = {
        "ok": True,
        "code": code,
        "country": country,
        "currency": "KRW" if is_kr else "USD",
        "name": None,
        "market": None,
        "price": None,
        "market_cap": None,
        "equity": None,
        "net_income": None,
        "operating_income": None,
        "total_liabilities": None,
        "per": None,
        "pbr": None,
        "roe": None,
        "debt_ratio": None,
        "source": {},
    }

    if is_kr:
        # 1) market data via Daum (already has price + market cap)
        kr_search = markets.search_korean(code, limit=1)
        if kr_search:
            row = kr_search[0]
            result["name"] = row["name"]
            result["market"] = row["market"]
            result["price"] = row.get("price")
            result["market_cap"] = row.get("marcap")
            result["source"]["market"] = "daum"

        # 2) Financials via DART
        fin = dart.fetch_financials(code)
        result["equity"] = fin["equity"]
        result["net_income"] = fin["net_income"]
        result["operating_income"] = fin["operating_income"]
        result["total_liabilities"] = fin["total_liabilities"]
        result["source"]["financials"] = fin["source"]
        result["bsns_year"] = fin.get("bsns_year")
        result["report_code"] = fin.get("report_code")

    else:
        # US
        us_search = markets.search_us(code, limit=1)
        if us_search:
            row = us_search[0]
            result["name"] = row["name"]
            result["market"] = row["market"]

        q = yahoo.fetch_quote(code)
        result["price"] = q["price"]
        result["market_cap"] = q["market_cap"]
        if q.get("currency"):
            result["currency"] = q["currency"]
        result["source"]["market"] = "yahoo"

        fin = yahoo.fetch_financials(code)
        result["equity"] = fin["equity"]
        result["net_income"] = fin["net_income"]
        result["operating_income"] = fin["operating_income"]
        result["total_liabilities"] = fin["total_liabilities"]
        result["source"]["financials"] = "yahoo"

    # Metrics
    result["per"] = safe_div(result["market_cap"], result["net_income"])
    result["pbr"] = safe_div(result["market_cap"], result["equity"])
    roe = safe_div(result["net_income"], result["equity"])
    result["roe"] = roe * 100 if roe is not None else None
    dr = safe_div(result["total_liabilities"], result["equity"])
    result["debt_ratio"] = dr * 100 if dr is not None else None

    return result


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        code = qs.get("code", [""])[0]
        try:
            payload = analyze(code)
            status = 200 if payload.get("ok") else 400
        except Exception as e:
            payload = {"ok": False, "error": str(e)}
            status = 500

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=600")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
