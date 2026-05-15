"""
Turso HTTP API helper - lightweight, no driver dependency.
"""
import os
import json
from typing import List, Dict, Any, Optional
import requests


def _config():
    url = (os.environ.get("TURSO_DATABASE_URL") or "").strip()
    token = (os.environ.get("TURSO_AUTH_TOKEN") or "").strip()
    if not url or not token:
        raise RuntimeError("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set")
    # Convert libsql:// to https://
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://"):]
    return url, token


def execute(sql: str, args: Optional[List[Any]] = None) -> Dict:
    """
    Execute a single SQL statement.
    args: positional parameters (use ? placeholders in sql).
    Returns: {columns: [...], rows: [[v, v, ...], ...]}
    """
    base, token = _config()
    api = f"{base.rstrip('/')}/v2/pipeline"

    typed_args = []
    for a in (args or []):
        if a is None:
            typed_args.append({"type": "null", "value": None})
        elif isinstance(a, bool):
            typed_args.append({"type": "integer", "value": "1" if a else "0"})
        elif isinstance(a, int):
            typed_args.append({"type": "integer", "value": str(a)})
        elif isinstance(a, float):
            typed_args.append({"type": "float", "value": a})
        else:
            typed_args.append({"type": "text", "value": str(a)})

    payload = {
        "requests": [
            {"type": "execute", "stmt": {"sql": sql, "args": typed_args}},
            {"type": "close"},
        ]
    }
    r = requests.post(
        api,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()

    # Parse response
    results = data.get("results") or []
    for resp in results:
        if resp.get("type") != "ok":
            continue
        response = resp.get("response") or {}
        if response.get("type") != "execute":
            continue
        result = response.get("result") or {}
        cols = [c.get("name") for c in (result.get("cols") or [])]
        rows = []
        for raw_row in (result.get("rows") or []):
            row = []
            for cell in raw_row:
                v = cell.get("value")
                t = cell.get("type")
                if t == "integer":
                    row.append(int(v) if v is not None else None)
                elif t == "float":
                    row.append(float(v) if v is not None else None)
                elif t == "null":
                    row.append(None)
                else:
                    row.append(v)
            rows.append(row)
        return {"columns": cols, "rows": rows}

    return {"columns": [], "rows": []}


def query_one(sql: str, args: Optional[List[Any]] = None) -> Optional[Dict]:
    """Return first row as dict, or None."""
    result = execute(sql, args)
    if not result["rows"]:
        return None
    return dict(zip(result["columns"], result["rows"][0]))
