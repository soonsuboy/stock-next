import os
from pathlib import Path
from typing import Any, Iterable

import requests


def load_local_env() -> None:
  env_path = Path(__file__).resolve().parents[1] / ".env.local"
  if not env_path.exists():
    return

  for line in env_path.read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
      continue
    key, value = stripped.split("=", 1)
    key = key.strip()
    value = value.strip().strip('"').strip("'")
    if key and key not in os.environ:
      os.environ[key] = value


load_local_env()


def _pipeline_url() -> str:
  url = (os.environ.get("TURSO_DATABASE_URL") or "").strip()
  if not url:
    raise RuntimeError("TURSO_DATABASE_URL is not set")

  if url.startswith("libsql://"):
    url = "https://" + url[len("libsql://") :]

  return f"{url.rstrip('/')}/v2/pipeline"


def _headers() -> dict[str, str]:
  token = (os.environ.get("TURSO_AUTH_TOKEN") or "").strip()
  if not token:
    raise RuntimeError("TURSO_AUTH_TOKEN is not set")

  return {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
  }


def _typed_arg(value: Any) -> dict[str, Any]:
  if value is None:
    return {"type": "null", "value": None}
  if isinstance(value, bool):
    return {"type": "integer", "value": "1" if value else "0"}
  if isinstance(value, int):
    return {"type": "integer", "value": str(value)}
  if isinstance(value, float):
    return {"type": "float", "value": value}
  return {"type": "text", "value": str(value)}


def _decode_cell(cell: dict[str, Any]) -> Any:
  value = cell.get("value")
  kind = cell.get("type")
  if kind == "null":
    return None
  if kind == "integer":
    return int(value) if value is not None else None
  if kind == "float":
    return float(value) if value is not None else None
  return value


def _execute_request(sql: str, args: Iterable[Any] | None = None) -> dict[str, Any]:
  return {
    "type": "execute",
    "stmt": {
      "sql": sql,
      "args": [_typed_arg(arg) for arg in (args or [])],
    },
  }


def pipeline(statements: list[tuple[str, Iterable[Any] | None]]) -> list[dict[str, Any]]:
  requests_payload = [_execute_request(sql, args) for sql, args in statements]
  requests_payload.append({"type": "close"})

  response = requests.post(
    _pipeline_url(),
    headers=_headers(),
    json={"requests": requests_payload},
    timeout=60,
  )
  response.raise_for_status()
  return response.json().get("results") or []


def execute(sql: str, args: Iterable[Any] | None = None) -> dict[str, Any]:
  results = pipeline([(sql, args)])

  for item in results:
    if item.get("type") != "ok":
      continue
    response = item.get("response") or {}
    if response.get("type") != "execute":
      continue
    result = response.get("result") or {}
    columns = [column.get("name") for column in (result.get("cols") or [])]
    rows = []
    for raw_row in result.get("rows") or []:
      values = [_decode_cell(cell) for cell in raw_row]
      rows.append(dict(zip(columns, values)))
    return {"columns": columns, "rows": rows}

  return {"columns": [], "rows": []}


def query_one(sql: str, args: Iterable[Any] | None = None) -> dict[str, Any] | None:
  result = execute(sql, args)
  return result["rows"][0] if result["rows"] else None


def execute_many(
  sql: str,
  rows: list[Iterable[Any]],
  batch_size: int = 400,
) -> int:
  written = 0
  for start in range(0, len(rows), batch_size):
    batch = rows[start : start + batch_size]
    pipeline([(sql, args) for args in batch])
    written += len(batch)
  return written
