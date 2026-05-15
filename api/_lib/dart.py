"""
DART OpenAPI direct calls.
corp_code is looked up from Turso DB (pre-seeded).
"""
import os
from typing import Dict, Optional, List
from datetime import datetime
import requests

from _lib import db as turso_db

DART_BASE = "https://opendart.fss.or.kr/api"


def _api_key() -> str:
    key = (os.environ.get("DART_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("DART_API_KEY is not set")
    return key


def get_corp_code(stock_code: str) -> Optional[str]:
    """Lookup corp_code (8-digit) by stock_code (6-digit) from Turso DB."""
    sc = str(stock_code).zfill(6)
    row = turso_db.query_one(
        "SELECT corp_code FROM corp_codes WHERE stock_code = ?", [sc]
    )
    return row["corp_code"] if row else None


REPORT_CODES = [
    ("11011", "사업보고서"),
    ("11014", "3분기보고서"),
    ("11012", "반기보고서"),
    ("11013", "1분기보고서"),
]

ACCOUNT_PATTERNS = {
    "equity":            ["자본총계"],
    "net_income":        ["당기순이익", "당기순이익(손실)", "연결당기순이익"],
    "operating_income":  ["영업이익", "영업이익(손실)"],
    "total_liabilities": ["부채총계"],
}


def _to_number(s) -> Optional[float]:
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    txt = str(s).replace(",", "").strip()
    if not txt or txt == "-":
        return None
    try:
        return float(txt)
    except ValueError:
        return None


def _match_account(items: List[dict], patterns: List[str]) -> Optional[float]:
    for it in items:
        if it.get("account_nm") in patterns:
            return _to_number(it.get("thstrm_amount"))
    for p in patterns:
        for it in items:
            if p in (it.get("account_nm") or ""):
                return _to_number(it.get("thstrm_amount"))
    return None


def fetch_financials(stock_code: str, year: Optional[int] = None) -> Dict:
    if year is None:
        year = datetime.now().year

    out = {
        "equity": None,
        "net_income": None,
        "operating_income": None,
        "total_liabilities": None,
        "bsns_year": None,
        "report_code": None,
        "fs_div": None,
        "source": None,
    }

    corp = get_corp_code(stock_code)
    if not corp:
        out["source"] = "corp_code_not_found"
        return out

    url = f"{DART_BASE}/fnlttSinglAcntAll.json"

    for try_year in (year, year - 1):
        for rcode, rname in REPORT_CODES:
            for fs_div in ("CFS", "OFS"):
                try:
                    r = requests.get(
                        url,
                        params={
                            "crtfc_key": _api_key(),
                            "corp_code": corp,
                            "bsns_year": str(try_year),
                            "reprt_code": rcode,
                            "fs_div": fs_div,
                        },
                        timeout=10,
                    )
                    data = r.json()
                except Exception:
                    continue

                if data.get("status") != "000":
                    continue
                items = data.get("list") or []
                if not items:
                    continue

                for key, patterns in ACCOUNT_PATTERNS.items():
                    if out[key] is None:
                        out[key] = _match_account(items, patterns)

                out["bsns_year"] = str(try_year)
                out["report_code"] = rcode
                out["fs_div"] = fs_div
                out["source"] = f"{fs_div}/{rname}/{try_year}"

                if out["equity"] is not None and out["net_income"] is not None:
                    return out
                break  # CFS hit but missing -> try different report

    return out
