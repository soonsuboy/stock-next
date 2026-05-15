"""
DART OpenAPI 직접 호출 헬퍼.
opendartreader 라이브러리 대신 사용 (Python 3.12 호환).
"""
import os
import io
import zipfile
from typing import Optional

import requests
import pandas as pd

DART_BASE = "https://opendart.fss.or.kr/api"


def _api_key() -> str:
    key = os.environ.get("DART_API_KEY", "").strip()
    if not key:
        raise RuntimeError("DART_API_KEY is not set")
    return key


# ---- 기업 고유번호(corp_code) 조회 ----
# DART API는 종목코드(6자리) 대신 자체 corp_code(8자리)를 요구하는 엔드포인트가 많음.
# 한 번 받아서 캐싱.
_corp_code_cache: Optional[pd.DataFrame] = None


def get_corp_codes() -> pd.DataFrame:
    """
    DART 전체 기업 고유번호 목록을 다운로드해서 DataFrame 반환.
    columns: corp_code, corp_name, stock_code, modify_date
    """
    global _corp_code_cache
    if _corp_code_cache is not None:
        return _corp_code_cache

    url = f"{DART_BASE}/corpCode.xml"
    r = requests.get(url, params={"crtfc_key": _api_key()}, timeout=15)
    r.raise_for_status()

    # 응답은 ZIP 파일로 옴 → 풀면 CORPCODE.xml
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        with z.open("CORPCODE.xml") as f:
            df = pd.read_xml(f)

    # 컬럼 정리
    df = df.rename(columns={
        "corp_code": "corp_code",
        "corp_name": "corp_name",
        "stock_code": "stock_code",
    })
    # 상장사만 (stock_code가 6자리 종목코드면 상장)
    df["stock_code"] = df["stock_code"].astype(str).str.strip()
    _corp_code_cache = df
    return df


def find_corp_code(stock_code: str) -> Optional[str]:
    """종목코드(예: '005930') → corp_code(예: '00126380')"""
    df = get_corp_codes()
    stock_code = str(stock_code).zfill(6)
    row = df[df["stock_code"] == stock_code]
    if row.empty:
        return None
    return str(row["corp_code"].iloc[0]).zfill(8)


# ---- 재무제표 ----
REPORT_CODES = [
    ("11011", "사업보고서"),
    ("11014", "3분기보고서"),
    ("11012", "반기보고서"),
    ("11013", "1분기보고서"),
]


def fetch_finstate(corp_code: str, year: int, reprt_code: str, fs_div: str = "CFS") -> Optional[pd.DataFrame]:
    """
    단일회사 전체 재무제표 호출.
    fs_div: 'CFS' 연결재무제표, 'OFS' 별도재무제표
    """
    url = f"{DART_BASE}/fnlttSinglAcntAll.json"
    params = {
        "crtfc_key": _api_key(),
        "corp_code": corp_code,
        "bsns_year": str(year),
        "reprt_code": reprt_code,
        "fs_div": fs_div,
    }
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "000" or "list" not in data:
        return None
    return pd.DataFrame(data["list"])