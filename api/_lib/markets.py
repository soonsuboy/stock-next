"""
KRX + NASDAQ/NYSE listings and search.
Direct HTTP calls, no FDR/yfinance dependency.
"""
import io
import csv
from datetime import datetime, timedelta
from typing import List, Dict
import requests


def fetch_krx_listings() -> List[Dict]:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0",
        "Referer": "http://data.krx.co.kr/",
    })
    candidates = [datetime.now().strftime("%Y%m%d")]
    for i in range(1, 8):
        candidates.append((datetime.now() - timedelta(days=i)).strftime("%Y%m%d"))

    otp_url = "http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd"
    dl_url = "http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd"

    for trd in candidates:
        try:
            otp_payload = {
                "mktId": "ALL",
                "trdDd": trd,
                "money": "1",
                "csvxls_isNo": "false",
                "name": "fileDown",
                "url": "dbms/MDC/STAT/standard/MDCSTAT01501",
            }
            otp = session.post(otp_url, data=otp_payload, timeout=10).text
            csv_bytes = session.post(dl_url, data={"code": otp}, timeout=20).content
            text = csv_bytes.decode("euc-kr", errors="replace")
            reader = csv.DictReader(io.StringIO(text))
            rows = []
            for r in reader:
                code = (r.get("\uc885\ubaa9\ucf54\ub4dc") or "").strip().zfill(6)
                name = (r.get("\uc885\ubaa9\uba85") or "").strip()
                market = (r.get("\uc2dc\uc7a5\uad6c\ubd84") or "KRX").strip()
                try:
                    marcap = float((r.get("\uc2dc\uac00\ucd1d\uc561") or "0").replace(",", ""))
                except ValueError:
                    marcap = None
                if code and name:
                    rows.append({
                        "code": code,
                        "name": name,
                        "market": market,
                        "country": "KR",
                        "marcap": marcap,
                    })
            if rows:
                return rows
        except Exception:
            continue
    return []


def fetch_us_listings() -> List[Dict]:
    rows = []
    sources = [
        ("https://nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", "NASDAQ"),
        ("https://nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", "NYSE"),
    ]
    for url, default_market in sources:
        try:
            r = requests.get(url, timeout=15)
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
    return rows


def search(keyword: str, limit: int = 20) -> List[Dict]:
    keyword = (keyword or "").strip()
    if not keyword:
        return []
    kw_lower = keyword.lower()

    results = []
    for source in (fetch_krx_listings, fetch_us_listings):
        try:
            for row in source():
                if (kw_lower in row["code"].lower()
                        or kw_lower in row["name"].lower()):
                    results.append(row)
                    if len(results) >= limit * 2:
                        break
        except Exception:
            continue

    seen = set()
    deduped = []
    for r in results:
        if r["code"] in seen:
            continue
        seen.add(r["code"])
        deduped.append(r)

    return deduped[:limit]
