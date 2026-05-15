"""
Yahoo Finance v10 quoteSummary API - direct calls, no yfinance dependency.
"""
from typing import Dict, Optional
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
YF_BASE = "https://query1.finance.yahoo.com"


def fetch_quote(symbol: str) -> Dict:
    """
    Return: {price, market_cap, currency}
    """
    out = {"price": None, "market_cap": None, "currency": None}
    try:
        r = requests.get(
            f"{YF_BASE}/v8/finance/chart/{symbol}",
            params={"interval": "1d", "range": "5d"},
            headers={"User-Agent": UA},
            timeout=10,
        )
        data = r.json()
        result = (data.get("chart") or {}).get("result") or []
        if result:
            meta = result[0].get("meta") or {}
            out["price"] = meta.get("regularMarketPrice")
            out["currency"] = meta.get("currency")
    except Exception:
        pass

    # Market cap requires quoteSummary
    try:
        r = requests.get(
            f"{YF_BASE}/v10/finance/quoteSummary/{symbol}",
            params={"modules": "price,summaryDetail,defaultKeyStatistics"},
            headers={"User-Agent": UA},
            timeout=10,
        )
        data = r.json()
        result = (data.get("quoteSummary") or {}).get("result") or []
        if result:
            price_mod = result[0].get("price") or {}
            mc = price_mod.get("marketCap") or {}
            out["market_cap"] = mc.get("raw") if isinstance(mc, dict) else mc
            if out["currency"] is None:
                out["currency"] = price_mod.get("currency")
    except Exception:
        pass

    return out


def fetch_financials(symbol: str) -> Dict:
    """
    Return: {equity, net_income, operating_income, total_liabilities, source}
    """
    out = {
        "equity": None,
        "net_income": None,
        "operating_income": None,
        "total_liabilities": None,
        "source": "yahoo",
    }
    try:
        r = requests.get(
            f"{YF_BASE}/v10/finance/quoteSummary/{symbol}",
            params={
                "modules": "incomeStatementHistory,balanceSheetHistory,"
                           "defaultKeyStatistics,financialData"
            },
            headers={"User-Agent": UA},
            timeout=15,
        )
        data = r.json()
        result = (data.get("quoteSummary") or {}).get("result") or []
        if not result:
            return out
        block = result[0]

        # Income statement: most recent year
        income_hist = (block.get("incomeStatementHistory") or {}).get(
            "incomeStatementHistory"
        ) or []
        if income_hist:
            latest = income_hist[0]
            out["net_income"] = _raw(latest.get("netIncome"))
            out["operating_income"] = _raw(latest.get("operatingIncome"))

        # Balance sheet: most recent year
        balance_hist = (block.get("balanceSheetHistory") or {}).get(
            "balanceSheetStatements"
        ) or []
        if balance_hist:
            latest = balance_hist[0]
            out["equity"] = _raw(latest.get("totalStockholderEquity"))
            out["total_liabilities"] = _raw(latest.get("totalLiab"))
    except Exception:
        pass

    return out


def _raw(v):
    if isinstance(v, dict):
        return v.get("raw")
    return v


def fetch_usd_krw() -> Optional[float]:
    try:
        r = requests.get(
            f"{YF_BASE}/v8/finance/chart/KRW=X",
            params={"interval": "1d", "range": "5d"},
            headers={"User-Agent": UA},
            timeout=8,
        )
        data = r.json()
        result = (data.get("chart") or {}).get("result") or []
        if result:
            return (result[0].get("meta") or {}).get("regularMarketPrice")
    except Exception:
        return None
    return None
