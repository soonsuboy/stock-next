"""
KRX (via Naver Finance search) + NASDAQ/NYSE listings + unified search.
"""
import io
import csv
import re
import json
from typing import List, Dict, Optional
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


# ---- Korean stocks via Naver Finance search ----
def search_naver(keyword: str, limit: int = 20) -> List[Dict]:
    """
    Naver Finance autocomplete: returns Korean listings matching keyword.
    Endpoint returns JSON with items: {code, name, nm, typeName, ...}
    """
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
    headers = {"User-Agent": UA, "Referer": "https://finance.naver.com/"}
    try:
        r = requests.get(url, params=params, headers=headers, timeout=8)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return []

    rows: List[Dict] = []
    items = data.get("items") or []
    # items is list of buckets; each bucket is list of [name_arr, code_arr, ..., extra]
    for bucket in items:
        if not isinstance(bucket, list):
            continue
        for item in bucket:
            try:
                # Item shape:
                #   [["Samsung Electronics"], ["005930"], ["KOSPI"], ...]
                # Names/codes are nested lists.
                name = _first(item[0]) if len(item) > 0 else ""
                code = _first(item[1]) if len(item) > 1 else ""
                market = _first(item[2]) if len(item) > 2 else "KRX"
                if not code or not name:
                    continue
                if not re.fullmatch(r"\d{6}", code):
                    # Some buckets contain non-ticker entries; skip.
                    continue
                rows.append({
                    "code": code,
                    "name": name,
                    "market": market or "KRX",
                    "country": "KR",
                    "marcap": None,
                })
            except Exception:
                continue
            if len(rows) >= limit:
                return rows
    return rows


def _first(x):
    if isinstance(x, list):
        return x[0] if x else ""
    return x or ""


# ---- US stocks (NASDAQ Trader official listing files) ----
_us_cache: Optional[List[Dict]] = None


def fetch_us_listings() -> List[Dict]:
    global _us_cache
    if _us_cache is not None:
        return _us_cache

    rows: List[Dict] = []
    sources = [
        ("https://nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", "NASDAQ"),
        ("https://nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", "NYSE"),
    ]
    for url, default_market in sources:
        try:
            r = requests.get(url, timeout=15, headers={"User-Agent": UA})
            r.raise_for_status()
            lines = r.text.splitlines()
            if not lines:
                continue
            header = lines[0].split("|")
            for line in lines[1:]:
                if not line or line.startswith("File Creation"):
                    continue
                parts = line.split("|")
                if len(parts) < 2:
                    continue
                row = dict(zip(header, parts))
                symbol = row.get("Symbol") or row.get("ACT Symbol") or ""
                name = row.get("Security Name", "")
                if not symbol or not name:
                    continue
                if row.get("Test Issue", "N") == "Y":
                    continue
                exch = row.get("Exchange", "")
                market = default_market
                if exch == "N":
                    market = "NYSE"
                elif exch == "A":
                    market = "AMEX"
                elif exch == "Q":
                    market = "NASDAQ"
                rows.append({
                    "code": symbol.strip(),
                    "name": name.strip(),
                    "market": market,
                    "country": "US",
                    "marcap": None,
                })
        except Exception:
            continue

    _us_cache = rows
    return rows


def search_us(keyword: str, limit: int = 20) -> List[Dict]:
    kw = (keyword or "").strip().lower()
    if not kw:
        return []
    out = []
    for row in fetch_us_listings():
        if kw in row["code"].lower() or kw in row["name"].lower():
            out.append(row)
            if len(out) >= limit:
                break
    return out


# ---- Unified search ----
def search(keyword: str, limit: int = 20) -> List[Dict]:
    keyword = (keyword or "").strip()
    if not keyword:
        return []

    results: List[Dict] = []

    # Korean (Naver)
    try:
        results.extend(search_naver(keyword, limit=limit))
    except Exception:
        pass

    # US (NASDAQ Trader)
    try:
        results.extend(search_us(keyword, limit=limit))
    except Exception:
        pass

    # Dedupe by code, preserving order
    seen = set()
    deduped = []
    for r in results:
        if r["code"] in seen:
            continue
        seen.add(r["code"])
        deduped.append(r)
    return deduped[:limit]
