"""
Korean stocks via Daum Finance + US stocks via NASDAQ Trader.
Both work reliably from Vercel.
"""
import re
from typing import List, Dict, Optional
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


# ============================================================
# Korean stocks via Daum Finance
# ============================================================
def search_korean(keyword: str, limit: int = 20) -> List[Dict]:
    """
    Daum Finance search returns Korean listings with price + market cap.
    """
    url = "https://finance.daum.net/api/search/quotes"
    headers = {
        "User-Agent": UA,
        "Referer": "https://finance.daum.net/",
    }
    try:
        r = requests.get(
            url,
            params={"q": keyword, "limit": limit},
            headers=headers,
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    except Exception:
        return []

    rows: List[Dict] = []
    for q in data.get("quotes", []):
        if not q.get("isStock"):
            continue
        if q.get("isDelisted"):
            continue
        # symbolCode like "A005930" -> "005930"
        sym = (q.get("symbolCode") or "").lstrip("A")
        if not re.fullmatch(r"\d{6}", sym):
            continue
        name = q.get("name") or ""
        if not name:
            continue
        rows.append({
            "code": sym,
            "name": name,
            "market": q.get("market") or "KRX",
            "country": "KR",
            # Daum gives accTradePrice (trade value), but we also have listed share count + price
            "marcap": _calc_marcap(q),
            "price": q.get("tradePrice"),
        })
    return rows[:limit]


def _calc_marcap(q: dict) -> Optional[float]:
    price = q.get("tradePrice")
    shares = q.get("listedShareCount")
    if price is None or shares is None:
        return None
    try:
        return float(price) * float(shares)
    except (TypeError, ValueError):
        return None


# ============================================================
# US stocks via NASDAQ Trader official listings
# ============================================================
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
                # Filter out warrants, rights, units (less common, cleaner results)
                if any(t in symbol for t in ["$", ".", "="]):
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
    matches = []
    for row in fetch_us_listings():
        code_lower = row["code"].lower()
        name_lower = row["name"].lower()
        if kw == code_lower:
            score = 0  # exact ticker match -> highest priority
        elif code_lower.startswith(kw):
            score = 1
        elif kw in code_lower:
            score = 2
        elif name_lower.startswith(kw):
            score = 3
        elif kw in name_lower:
            score = 4
        else:
            continue
        # Deprioritize obvious ETFs/derivatives by name
        name_l = name_lower
        if any(t in name_l for t in [" etf", "yieldmax", "leverage", "daily bull", "daily bear", "short ", " 2x", " 3x"]):
            score += 10
        matches.append((score, row))

    matches.sort(key=lambda x: x[0])
    return [m[1] for m in matches[:limit]]


# ============================================================
# Unified search
# ============================================================
def search(keyword: str, limit: int = 20) -> List[Dict]:
    keyword = (keyword or "").strip()
    if not keyword:
        return []

    results: List[Dict] = []
    try:
        results.extend(search_korean(keyword, limit=limit))
    except Exception:
        pass
    try:
        results.extend(search_us(keyword, limit=limit))
    except Exception:
        pass

    # Dedupe by code, preserving order
    seen = set()
    out = []
    for r in results:
        if r["code"] in seen:
            continue
        seen.add(r["code"])
        out.append(r)
    return out[:limit]
