"""
Test which Korean stock data sources work from Vercel.
GET /api/diag?q=<keyword>
"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def probe(name, url, params=None, headers=None):
    try:
        r = requests.get(url, params=params or {}, headers=headers or {}, timeout=8)
        snippet = r.text[:500] if r.text else ""
        return {
            "name": name,
            "url": url,
            "status_code": r.status_code,
            "ok": r.ok,
            "snippet": snippet,
        }
    except Exception as e:
        return {"name": name, "url": url, "exception": str(e)}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        keyword = qs.get("q", ["samsung"])[0]

        h = {"User-Agent": UA}

        result = {
            "keyword": keyword,
            "tests": [
                # 1) Naver Finance autocomplete (failed in last test - keep for comparison)
                probe(
                    "naver_ac",
                    "https://ac.finance.naver.com/ac",
                    params={"q": keyword, "q_enc": "UTF-8", "st": "111", "frm": "stock",
                            "r_format": "json", "r_enc": "UTF-8"},
                    headers={**h, "Referer": "https://finance.naver.com/"},
                ),
                # 2) Naver main finance domain - just check DNS works
                probe(
                    "naver_main",
                    "https://finance.naver.com/",
                    headers=h,
                ),
                # 3) Daum/Kakao Finance
                probe(
                    "daum_finance",
                    "https://finance.daum.net/api/search/quotes",
                    params={"q": keyword, "limit": 10},
                    headers={**h, "Referer": "https://finance.daum.net/"},
                ),
                # 4) Yahoo Finance search (also covers Korean tickers like 005930.KS)
                probe(
                    "yahoo_search",
                    "https://query1.finance.yahoo.com/v1/finance/search",
                    params={"q": keyword, "quotesCount": 10, "newsCount": 0},
                    headers=h,
                ),
                # 5) Investing.com search
                probe(
                    "investing_search",
                    "https://api.investing.com/api/financialdata/search",
                    params={"q": keyword},
                    headers={**h, "Referer": "https://www.investing.com/"},
                ),
            ],
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False, indent=2).encode("utf-8"))
