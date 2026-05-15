"""
DART OpenAPI direct calls - no opendartreader dependency.
"""
import os
import io
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Optional, List
import requests

DART_BASE = "https://opendart.fss.or.kr/api"


def _api_key() -> str:
    key = (os.environ.get("DART_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("DART_API_KEY is not set")
    return key


# ---------- corp_code lookup (cached in module) ----------
_corp_index: Optional[Dict[str, str]] = None  # stock_code(6) -> corp_code(8)


def _build_corp_index() -> Dict[str, str]:
    """Download DART corp code list and build stock_code -> corp_code map."""
    url = f"{DART_BASE}/corpCode.xml"
    r = requests.get(url, params={"crtfc_key": _api_key()}, timeout=20)
    r.raise_for_status()

    idx: Dict[str, str] = {}
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        with z.open("CORPCODE.xml") as f:
            tree = ET.parse(f)
            root = tree.getroot()
            for item in root.findall(".//list"):
                stock_code = (item.findtext("stock_code") or "").strip()
                corp_code = (item.findtext("corp_code") or "").strip()
                if stock_code and corp_code:
                    idx[stock_code.zfill(6)] = corp_code.zfill(8)
    return idx


def get_corp_code(stock_code: str) -> Optional[str]:
    """Lookup corp_code (8-digit) by stock_code (6-digit)."""
    global _corp_index
    if _corp_index is None:
        _corp_index = _build_corp_index()
    return _corp_index.get(str(stock_code).zfill(6))


# ---------- Financial statements ----------
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
    """Find first matching account by name; tolerant of slight variations."""
    # exact match first
    for it in items:
        if it.get("account_nm") in patterns:
            return _to_number(it.get("thstrm_amount"))
    # then partial
    for p in patterns:
        for it in items:
            if p in (it.get("account_nm") or ""):
                return _to_number(it.get("thstrm_amount"))
    return None


def fetch_financials(stock_code: str, year: Optional[int] = None) -> Dict:
    """
    Find most recent report and extract key accounts.
    Returns: {equity, net_income, operating_income, total_liabilities,
              bsns_year, report_code, fs_div, source}
    """
    from datetime import datetime
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
                        timeout=15,
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
                break  # CFS hit but missing some -> don't try OFS for same report

    return out
