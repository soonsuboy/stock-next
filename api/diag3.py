"""
Diagnostic: see what Yahoo quoteSummary actually returns from Vercel.
GET /api/diag3?symbol=TSLA
"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import requests


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        symbol = qs.get("symbol", ["TSLA"])[0]
        UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

        result = {"symbol": symbol, "tests": []}

        # Test 1: chart (already works)
        try:
            r = requests.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                params={"interval": "1d", "range": "5d"},
                headers={"User-Agent": UA},
                timeout=10,
            )
            result["tests"].append({
                "name": "chart",
                "status": r.status_code,
                "snippet": r.text[:500],
            })
        except Exception as e:
            result["tests"].append({"name": "chart", "exception": str(e)})

        # Test 2: quoteSummary
        try:
            r = requests.get(
                f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}",
                params={"modules": "price,defaultKeyStatistics"},
                headers={"User-Agent": UA, "Accept": "application/json"},
                timeout=10,
            )
            result["tests"].append({
                "name": "quoteSummary",
                "status": r.status_code,
                "final_url": r.url,
                "snippet": r.text[:800],
            })
        except Exception as e:
            result["tests"].append({"name": "quoteSummary", "exception": str(e)})

        # Test 3: query2 instead of query1
        try:
            r = requests.get(
                f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}",
                params={"modules": "price"},
                headers={"User-Agent": UA},
                timeout=10,
            )
            result["tests"].append({
                "name": "quoteSummary_query2",
                "status": r.status_code,
                "snippet": r.text[:500],
            })
        except Exception as e:
            result["tests"].append({"name": "quoteSummary_query2", "exception": str(e)})

        # Test 4: quote (simpler endpoint, less likely to be blocked)
        try:
            r = requests.get(
                f"https://query1.finance.yahoo.com/v7/finance/quote",
                params={"symbols": symbol},
                headers={"User-Agent": UA},
                timeout=10,
            )
            result["tests"].append({
                "name": "quote_v7",
                "status": r.status_code,
                "snippet": r.text[:500],
            })
        except Exception as e:
            result["tests"].append({"name": "quote_v7", "exception": str(e)})

        # Test 5: yfinance-style with crumb (would need cookie, but let's see)
        try:
            r = requests.get(
                f"https://finance.yahoo.com/quote/{symbol}",
                headers={"User-Agent": UA},
                timeout=10,
            )
            result["tests"].append({
                "name": "html_page",
                "status": r.status_code,
                "length": len(r.text),
            })
        except Exception as e:
            result["tests"].append({"name": "html_page", "exception": str(e)})

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False, indent=2).encode("utf-8"))
