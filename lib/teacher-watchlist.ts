import { db } from "@/lib/db";

export type TeacherWatchlistCountry = "KR" | "US" | "PRIVATE";

interface TeacherWatchlistSeed {
  code: string;
  country: TeacherWatchlistCountry;
  displayName: string;
  companyName: string;
  market: string;
  currency: string;
  gicsSector: string;
  industryName: string;
  note?: string;
}

export const TEACHER_WATCHLIST_SEEDS: TeacherWatchlistSeed[] = [
  {
    code: "NVDA",
    country: "US",
    displayName: "엔비디아",
    companyName: "NVIDIA Corporation",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Semiconductors",
  },
  {
    code: "005930",
    country: "KR",
    displayName: "삼성전자",
    companyName: "삼성전자",
    market: "KRX",
    currency: "KRW",
    gicsSector: "정보기술",
    industryName: "반도체와반도체장비",
  },
  {
    code: "000660",
    country: "KR",
    displayName: "SK하이닉스",
    companyName: "SK하이닉스",
    market: "KRX",
    currency: "KRW",
    gicsSector: "정보기술",
    industryName: "반도체와반도체장비",
  },
  {
    code: "TSM",
    country: "US",
    displayName: "TSMC",
    companyName: "Taiwan Semiconductor Manufacturing Company Limited",
    market: "NYSE",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Semiconductors",
  },
  {
    code: "AVGO",
    country: "US",
    displayName: "브로드컴",
    companyName: "Broadcom Inc.",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Semiconductors",
  },
  {
    code: "WDC",
    country: "US",
    displayName: "샌디스크 (WDC)",
    companyName: "Western Digital Corporation",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Technology Hardware, Storage & Peripherals",
    note: "요청명은 샌디스크이나 현재 상장 티커는 WDC 기준으로 추적",
  },
  {
    code: "009150",
    country: "KR",
    displayName: "삼성전기",
    companyName: "삼성전기",
    market: "KRX",
    currency: "KRW",
    gicsSector: "정보기술",
    industryName: "전자장비와기기",
  },
  {
    code: "MRVL",
    country: "US",
    displayName: "마벨테크놀로지",
    companyName: "Marvell Technology, Inc.",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Semiconductors",
  },
  {
    code: "GOOGL",
    country: "US",
    displayName: "알파벳",
    companyName: "Alphabet Inc. Class A",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "커뮤니케이션",
    industryName: "Interactive Media & Services",
  },
  {
    code: "MSFT",
    country: "US",
    displayName: "마이크로소프트",
    companyName: "Microsoft Corporation",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Software",
  },
  {
    code: "META",
    country: "US",
    displayName: "메타",
    companyName: "Meta Platforms, Inc.",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "커뮤니케이션",
    industryName: "Interactive Media & Services",
  },
  {
    code: "AMZN",
    country: "US",
    displayName: "아마존",
    companyName: "Amazon.com, Inc.",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "경기소비재",
    industryName: "Broadline Retail",
  },
  {
    code: "PLTR",
    country: "US",
    displayName: "팔란티어",
    companyName: "Palantir Technologies Inc.",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Software",
  },
  {
    code: "005380",
    country: "KR",
    displayName: "현대차",
    companyName: "현대차",
    market: "KRX",
    currency: "KRW",
    gicsSector: "경기소비재",
    industryName: "자동차",
  },
  {
    code: "012330",
    country: "KR",
    displayName: "현대모비스",
    companyName: "현대모비스",
    market: "KRX",
    currency: "KRW",
    gicsSector: "경기소비재",
    industryName: "자동차부품",
  },
  {
    code: "TSLA",
    country: "US",
    displayName: "테슬라",
    companyName: "Tesla, Inc.",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "경기소비재",
    industryName: "Automobiles",
  },
  {
    code: "LEU",
    country: "US",
    displayName: "센트러스 에너지",
    companyName: "Centrus Energy Corp.",
    market: "NYSE",
    currency: "USD",
    gicsSector: "에너지",
    industryName: "Uranium & Nuclear Fuel",
  },
  {
    code: "ETN",
    country: "US",
    displayName: "이튼",
    companyName: "Eaton Corporation plc",
    market: "NYSE",
    currency: "USD",
    gicsSector: "산업재",
    industryName: "Electrical Components & Equipment",
  },
  {
    code: "GEV",
    country: "US",
    displayName: "GE버노바",
    companyName: "GE Vernova Inc.",
    market: "NYSE",
    currency: "USD",
    gicsSector: "산업재",
    industryName: "Electrical Equipment",
  },
  {
    code: "012450",
    country: "KR",
    displayName: "한화에어로스페이스",
    companyName: "한화에어로스페이스",
    market: "KRX",
    currency: "KRW",
    gicsSector: "산업재",
    industryName: "우주항공과국방",
  },
  {
    code: "079550",
    country: "KR",
    displayName: "LIG넥스원",
    companyName: "LIG넥스원",
    market: "KRX",
    currency: "KRW",
    gicsSector: "산업재",
    industryName: "우주항공과국방",
  },
  {
    code: "SPACEX",
    country: "PRIVATE",
    displayName: "스페이스X",
    companyName: "SpaceX",
    market: "비상장",
    currency: "USD",
    gicsSector: "산업재",
    industryName: "Aerospace",
    note: "비상장 기업이라 일일 주식 가격 배치에서 제외",
  },
  {
    code: "003230",
    country: "KR",
    displayName: "삼양식품",
    companyName: "삼양식품",
    market: "KRX",
    currency: "KRW",
    gicsSector: "필수소비재",
    industryName: "식품",
  },
  {
    code: "AAPL",
    country: "US",
    displayName: "애플",
    companyName: "Apple Inc.",
    market: "NASDAQ",
    currency: "USD",
    gicsSector: "정보기술",
    industryName: "Technology Hardware, Storage & Peripherals",
  },
  {
    code: "032830",
    country: "KR",
    displayName: "삼성생명",
    companyName: "삼성생명",
    market: "KRX",
    currency: "KRW",
    gicsSector: "금융",
    industryName: "생명보험",
  },
  {
    code: "016360",
    country: "KR",
    displayName: "삼성증권",
    companyName: "삼성증권",
    market: "KRX",
    currency: "KRW",
    gicsSector: "금융",
    industryName: "증권",
  },
  {
    code: "017670",
    country: "KR",
    displayName: "SK텔레콤",
    companyName: "SK텔레콤",
    market: "KRX",
    currency: "KRW",
    gicsSector: "커뮤니케이션",
    industryName: "무선통신서비스",
  },
];

export async function ensureTeacherWatchlist() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS teacher_watchlist (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       code        TEXT NOT NULL,
       country     TEXT NOT NULL CHECK(country IN ('KR', 'US', 'PRIVATE')),
       display_name TEXT NOT NULL,
       market      TEXT,
       currency    TEXT,
       gics_sector TEXT,
       note        TEXT,
       sort_order  INTEGER NOT NULL,
       active      INTEGER NOT NULL DEFAULT 1,
       added_at    TEXT DEFAULT CURRENT_TIMESTAMP,
       updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(code, country)
     )`
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_teacher_watchlist_active_order ON teacher_watchlist(active, sort_order)"
  );

  for (const item of TEACHER_WATCHLIST_SEEDS) {
    if (item.country === "KR" || item.country === "US") {
      await db.execute({
        sql: `INSERT INTO companies
              (code, country, name, market, currency, gics_sector,
               industry_name, sector_source, source, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'teacher_watchlist_seed',
                      'teacher_watchlist_seed', CURRENT_TIMESTAMP)
              ON CONFLICT(code, country) DO UPDATE SET
                gics_sector = COALESCE(NULLIF(companies.gics_sector, ''), excluded.gics_sector),
                industry_name = COALESCE(NULLIF(companies.industry_name, ''), excluded.industry_name),
                sector_source = COALESCE(NULLIF(companies.sector_source, ''), excluded.sector_source),
                updated_at = CURRENT_TIMESTAMP`,
        args: [
          item.code,
          item.country,
          item.companyName,
          item.market,
          item.currency,
          item.gicsSector,
          item.industryName,
        ],
      });
    }
  }

  for (const [index, item] of TEACHER_WATCHLIST_SEEDS.entries()) {
    await db.execute({
      sql: `INSERT INTO teacher_watchlist
            (code, country, display_name, market, currency, gics_sector,
             note, sort_order, active, added_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(code, country) DO UPDATE SET
              display_name = excluded.display_name,
              market = excluded.market,
              currency = excluded.currency,
              gics_sector = excluded.gics_sector,
              note = excluded.note,
              sort_order = excluded.sort_order,
              active = 1,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        item.code,
        item.country,
        item.displayName,
        item.market,
        item.currency,
        item.gicsSector,
        item.note || null,
        index + 1,
      ],
    });
  }
}
