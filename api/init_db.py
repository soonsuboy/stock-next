"""
DB 초기화 스크립트 - watchlist, financials 테이블 생성
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib import db as turso_db


def init_db():
    """Create tables if they don't exist."""
    
    # 1. watchlist 테이블 생성
    print("[1/4] watchlist 테이블 생성 중...")
    try:
        turso_db.execute("""
            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                country TEXT NOT NULL CHECK(country IN ('KR', 'US')),
                market TEXT,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ watchlist 테이블 생성/확인 완료")
    except Exception as e:
        print(f"❌ watchlist 테이블 생성 실패: {e}")
        return False

    # 2. financials 테이블 생성
    print("[2/4] financials 테이블 생성 중...")
    try:
        turso_db.execute("""
            CREATE TABLE IF NOT EXISTS financials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL,
                country TEXT NOT NULL CHECK(country IN ('KR', 'US')),
                data_date DATE NOT NULL,
                price REAL,
                market_cap REAL,
                equity REAL,
                net_income REAL,
                operating_income REAL,
                total_liabilities REAL,
                roe REAL,
                pbr REAL,
                per REAL,
                debt_ratio REAL,
                source TEXT,
                collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(code, country, data_date),
                FOREIGN KEY(code) REFERENCES watchlist(code)
            )
        """)
        print("✅ financials 테이블 생성/확인 완료")
    except Exception as e:
        print(f"❌ financials 테이블 생성 실패: {e}")
        return False

    # 3. 인덱스 생성 (성능 최적화)
    print("[3/4] 인덱스 생성 중...")
    try:
        turso_db.execute("CREATE INDEX IF NOT EXISTS idx_financials_code ON financials(code)")
        turso_db.execute("CREATE INDEX IF NOT EXISTS idx_financials_date ON financials(data_date)")
        turso_db.execute("CREATE INDEX IF NOT EXISTS idx_financials_code_date ON financials(code, data_date)")
        print("✅ 인덱스 생성 완료")
    except Exception as e:
        print(f"❌ 인덱스 생성 실패: {e}")
        return False

    # 4. 기존 corp_codes 테이블 확인
    print("[4/4] 기존 테이블 확인 중...")
    try:
        result = turso_db.execute("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'")
        cols = result.get("columns", [])
        rows = result.get("rows", [])
        
        print("\n📊 생성된 테이블 목록:")
        tables = turso_db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        if tables.get("rows"):
            for row in tables["rows"]:
                print(f"  - {row[0]}")
        else:
            print("  (테이블 없음)")
    except Exception as e:
        print(f"⚠️  테이블 목록 조회 실패: {e}")
        return False

    print("\n✅ DB 초기화 완료!")
    return True


if __name__ == "__main__":
    success = init_db()
    sys.exit(0 if success else 1)
