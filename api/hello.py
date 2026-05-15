from http.server import BaseHTTPRequestHandler
import json
import os
import sys


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        dart_status = "not_tested"
        try:
            import requests
            key = os.environ.get("DART_API_KEY", "").strip()
            if key:
                r = requests.get(
                    "https://opendart.fss.or.kr/api/list.json",
                    params={"crtfc_key": key, "page_count": 1},
                    timeout=10,
                )
                dart_status = r.json().get("status", "unknown")
        except Exception as e:
            dart_status = f"error: {e}"

        response = {
            "message": "Hello from Python on Vercel!",
            "python_version": sys.version,
            "has_dart_key": bool(os.environ.get("DART_API_KEY")),
            "has_turso_url": bool(os.environ.get("TURSO_DATABASE_URL")),
            "dart_api_status": dart_status,
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))
