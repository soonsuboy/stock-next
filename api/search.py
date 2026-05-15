from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib.markets import search


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            keyword = qs.get("q", [""])[0]
            try:
                limit = int(qs.get("limit", ["20"])[0])
            except ValueError:
                limit = 20

            results = search(keyword, limit=limit)
            payload = {"ok": True, "count": len(results), "results": results}
            status = 200
        except Exception as e:
            payload = {"ok": False, "error": str(e)}
            status = 500

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
