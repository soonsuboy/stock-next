"""
Diagnostic endpoint - shows raw response from Naver Finance search.
GET /api/diag?q=<keyword>
"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import requests


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        keyword = qs.get("q", ["samsung"])[0]

        url = "https://ac.finance.naver.com/ac"
        params = {
            "q": keyword,
            "q_enc": "UTF-8",
            "st": "111",
            "frm": "stock",
            "r_format": "json",
            "r_enc": "UTF-8",
            "r_unicode": "0",
            "t_koreng": "1",
            "r_lt": "111",
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://finance.naver.com/",
        }

        result = {
            "request_url": url,
            "params": params,
        }

        try:
            r = requests.get(url, params=params, headers=headers, timeout=10)
            result["status_code"] = r.status_code
            result["final_url"] = r.url
            result["response_headers"] = dict(r.headers)
            result["body_text"] = r.text[:5000]
            try:
                result["body_json"] = r.json()
            except Exception as e:
                result["json_parse_error"] = str(e)
        except Exception as e:
            result["exception"] = str(e)

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False, indent=2).encode("utf-8"))
