"""
GET /api/batch_update
종목별 재무제표 일괄 수집 및 DB 저장 (watchlist의 모든 종목)
"""
from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib import db as turso_db, markets, yahoo, dart


def batch_update_financials():
    """
    watchlist의 모든 종목의 재무제표를 수집하고 DB에 저장
    """
    try:
        # 1. watchlist에서 모든 종목 조회
        watchlist_result = turso_db.execute("SELECT code, country FROM watchlist")
        if not watchlist_result.get("rows"):
            return {"ok": True, "message": "watchlist is empty", "updated": 0}

        updated = 0
        errors = []

        for row in watchlist_result["rows"]:
            code = row[0]  # code
            country = row[1]  # country

            try:
                if country == "KR":
                    # 한국: DART
                    fin = dart.fetch_financials(code)
                    market_cap = None  # Daum은 주가가 있어야 계산 가능
                else:
                    # 미국: Yahoo Finance
                    quote = yahoo.fetch_quote(code)
                    market_cap = quote.get("market_cap")
                    fin = yahoo.fetch_financials(code)

                # 지표 계산
                def safe_div(a, b):
                    if a is None or b is None or b == 0:
                        return None
                    try:
                        return a / b
                    except:
                        return None

                roe = safe_div(fin.get("net_income"), fin.get("equity"))
                per = safe_div(market_cap, fin.get("net_income"))
                pbr = safe_div(market_cap, fin.get("equity"))
                dr = safe_div(fin.get("total_liabilities"), fin.get("equity"))

                # DB에 저장
                turso_db.execute(
                    """
                    INSERT INTO financials 
                    (code, country, data_date, market_cap, equity, net_income, 
                     operating_income, total_liabilities, roe, pbr, per, debt_ratio, source, collected_at)
                    VALUES (?, ?, DATE('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    [
                        code,
                        country,
                        market_cap,
                        fin.get("equity"),
                        fin.get("net_income"),
                        fin.get("operating_income"),
                        fin.get("total_liabilities"),
                        roe * 100 if roe else None,
                        pbr,
                        per,
                        dr * 100 if dr else None,
                        fin.get("source", "unknown"),
                    ],
                )
                updated += 1
            except Exception as e:
                errors.append(f"{code}: {str(e)}")
                continue

        return {
            "ok": True,
            "updated": updated,
            "errors": errors,
            "total_stocks": len(watchlist_result["rows"]),
        }

    except Exception as e:
        return {"ok": False, "error": str(e)}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        result = batch_update_financials()

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))

    def log_message(self, format, *args):
        pass  # 로깅 비활성화
