from http.server import BaseHTTPRequestHandler
import json
import os


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        response = {
            "message": "Hello from Python on Vercel!",
            "python_version": os.sys.version,
            "has_dart_key": bool(os.environ.get("DART_API_KEY")),
            "has_turso_url": bool(os.environ.get("TURSO_DATABASE_URL")),
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))
        return