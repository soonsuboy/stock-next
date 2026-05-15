import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface FinancialData {
  equity?: number;
  net_income?: number;
  operating_income?: number;
  total_liabilities?: number;
  source?: string;
  bsns_year?: string;
  report_code?: string;
  shares_outstanding?: number;
  fiscal_year?: string;
  form?: string;
}

// ============================================================
// 미국 주식: SEC XBRL + Stooq
// ============================================================
const SEC_HEADERS = {
  "User-Agent":
    process.env.SEC_USER_AGENT ||
    "soonsuboy-stock-next/1.0 (soonsuboy users noreply github com)",
  "Accept-Encoding": "gzip, deflate",
};

let secTickerCache: Map<string, number> | null = null;

interface SecFact {
  val?: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  end?: string;
}

interface SecTickerRow {
  ticker?: string;
  cik_str?: number;
}

interface SecConcept {
  units?: Record<string, SecFact[]>;
}

interface YahooReportedValue {
  raw?: number;
}

interface YahooTimeSeriesPoint {
  asOfDate?: string;
  reportedValue?: YahooReportedValue;
}

interface YahooTimeSeriesResult {
  meta?: {
    type?: string[];
  };
  [key: string]: unknown;
}

interface DartAccount {
  account_nm?: string;
  thstrm_amount?: unknown;
}

interface KoreanQuote {
  symbolCode?: string;
  isStock?: boolean;
  isDelisted?: boolean;
  tradePrice?: number;
  listedShareCount?: number;
  name?: string;
  market?: string;
}

interface AnalysisResult {
  ok: boolean;
  code: string;
  country: "KR" | "US";
  currency: string;
  name: string | null;
  market: string | null;
  price: number | null;
  market_cap: number | null;
  equity: number | null;
  net_income: number | null;
  operating_income: number | null;
  total_liabilities: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  debt_ratio: number | null;
  source: Record<string, string | undefined>;
  bsns_year?: string;
  report_code?: string;
}

function parseSource(value: unknown): Record<string, string | undefined> {
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, val]) => [
        key,
        val === undefined ? undefined : String(val),
      ])
    );
  } catch {
    return {};
  }
}

async function fetchSecTickerMap(): Promise<Map<string, number>> {
  if (secTickerCache) return secTickerCache;

  const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: SEC_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error("SEC ticker map fetch failed");
  }

  const data = (await response.json()) as Record<string, SecTickerRow>;
  const out = new Map<string, number>();

  for (const row of Object.values(data)) {
    if (row?.ticker && row?.cik_str) {
      out.set(String(row.ticker).toUpperCase(), Number(row.cik_str));
    }
  }

  secTickerCache = out;
  return out;
}

async function lookupCik(symbol: string): Promise<number | undefined> {
  const map = await fetchSecTickerMap();
  return map.get(symbol.toUpperCase());
}

function latestAnnualFactFromUnits(
  unitBlock: Record<string, SecFact[]> | undefined,
  concept: string,
  units: string[]
): SecFact | undefined {
  const candidates: SecFact[] = [];

  if (!unitBlock) return undefined;

  for (const unit of units) {
    const rows = unitBlock[unit] ?? [];
    for (const row of rows) {
      const form = String(row.form ?? "");
      const isAnnual =
        row.fp === "FY" ||
        form === "10-K" ||
        form === "10-K/A" ||
        concept === "EntityCommonStockSharesOutstanding";

      if (row.val === undefined || !isAnnual) continue;
      if (form && !["10-K", "10-K/A", "8-K"].includes(form)) continue;

      candidates.push(row);
    }
  }

  candidates.sort((a, b) => {
    const aDate = `${a.filed ?? ""}-${a.end ?? ""}`;
    const bDate = `${b.filed ?? ""}-${b.end ?? ""}`;
    return bDate.localeCompare(aDate);
  });

  return candidates[0];
}

async function fetchSecConcept(
  paddedCik: string,
  taxonomy: "us-gaap" | "dei",
  concepts: string[],
  units: string[]
): Promise<SecFact | undefined> {
  for (const concept of concepts) {
    try {
      const response = await fetch(
        `https://data.sec.gov/api/xbrl/companyconcept/CIK${paddedCik}/${taxonomy}/${concept}.json`,
        {
          headers: SEC_HEADERS,
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!response.ok) continue;

      const data = (await response.json()) as SecConcept;
      const fact = latestAnnualFactFromUnits(data.units, concept, units);
      if (fact) return fact;
    } catch {
      continue;
    }
  }

  return undefined;
}

function latestYahooRaw(
  rows: YahooTimeSeriesResult[],
  key: string
): { value?: number; asOfDate?: string } {
  const block = rows.find((row) => row.meta?.type?.includes(key));
  const points = block?.[key] as YahooTimeSeriesPoint[] | undefined;
  const latest = points
    ?.filter((point) => typeof point.reportedValue?.raw === "number")
    .sort((a, b) => (b.asOfDate ?? "").localeCompare(a.asOfDate ?? ""))[0];

  return {
    value: latest?.reportedValue?.raw,
    asOfDate: latest?.asOfDate,
  };
}

async function fetchYahooTimeSeriesFinancials(
  symbol: string
): Promise<FinancialData> {
  try {
    const period2 = Math.floor(Date.now() / 1000);
    const types = [
      "annualNetIncome",
      "annualStockholdersEquity",
      "annualTotalLiabilitiesNetMinorityInterest",
      "annualOperatingIncome",
      "annualBasicAverageShares",
      "annualDilutedAverageShares",
      "quarterlyBasicAverageShares",
    ].join(",");

    const response = await fetch(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=${types}&period1=0&period2=${period2}`,
      {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return { source: "yahoo_timeseries_error" };

    const data = (await response.json()) as {
      timeseries?: { result?: YahooTimeSeriesResult[] };
    };
    const rows = data.timeseries?.result ?? [];
    const equity = latestYahooRaw(rows, "annualStockholdersEquity");
    const netIncome = latestYahooRaw(rows, "annualNetIncome");
    const operatingIncome = latestYahooRaw(rows, "annualOperatingIncome");
    const liabilities = latestYahooRaw(
      rows,
      "annualTotalLiabilitiesNetMinorityInterest"
    );
    const annualBasicShares = latestYahooRaw(rows, "annualBasicAverageShares");
    const annualDilutedShares = latestYahooRaw(rows, "annualDilutedAverageShares");
    const quarterlyShares = latestYahooRaw(rows, "quarterlyBasicAverageShares");

    const anchorDate =
      equity.asOfDate ||
      netIncome.asOfDate ||
      operatingIncome.asOfDate ||
      liabilities.asOfDate;

    return {
      equity: equity.value,
      net_income: netIncome.value,
      operating_income: operatingIncome.value,
      total_liabilities: liabilities.value,
      shares_outstanding:
        annualBasicShares.value ||
        annualDilutedShares.value ||
        quarterlyShares.value,
      fiscal_year: anchorDate?.slice(0, 4),
      form: "annual",
      source: "yahoo_timeseries",
    };
  } catch {
    return { source: "yahoo_timeseries_error" };
  }
}

async function fetchUsFinancials(symbol: string): Promise<FinancialData> {
  const yahoo = await fetchYahooTimeSeriesFinancials(symbol);
  if (yahoo.equity !== undefined && yahoo.net_income !== undefined) {
    return yahoo;
  }

  try {
    const cik = await lookupCik(symbol);
    if (!cik) return { source: "sec_cik_not_found" };

    const paddedCik = String(cik).padStart(10, "0");

    const [equity, netIncome, operatingIncome, liabilities, shares] =
      await Promise.all([
        fetchSecConcept(paddedCik, "us-gaap", [
          "StockholdersEquity",
          "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        ], ["USD"]),
        fetchSecConcept(paddedCik, "us-gaap", [
          "NetIncomeLoss",
          "ProfitLoss",
          "NetIncomeLossAvailableToCommonStockholdersBasic",
        ], ["USD"]),
        fetchSecConcept(paddedCik, "us-gaap", [
          "OperatingIncomeLoss",
        ], ["USD"]),
        fetchSecConcept(paddedCik, "us-gaap", [
          "Liabilities",
          "LiabilitiesCurrent",
        ], ["USD"]),
        fetchSecConcept(paddedCik, "dei", [
          "EntityCommonStockSharesOutstanding",
        ], ["shares"]),
      ]);

    const anchor = equity ?? netIncome ?? operatingIncome ?? liabilities;
    const out: FinancialData = {
      equity: equity?.val,
      net_income: netIncome?.val,
      operating_income: operatingIncome?.val,
      total_liabilities: liabilities?.val,
      shares_outstanding: shares?.val,
      fiscal_year: anchor?.fy ? String(anchor.fy) : undefined,
      form: anchor?.form,
      source: `sec_concepts/${paddedCik}`,
    };

    return out;
  } catch {
    return { source: "sec_error" };
  }
}

async function fetchUsQuote(
  symbol: string
): Promise<{ price?: number; market_cap?: number; currency?: string }> {
  try {
    const stooqSymbol = `${symbol.toLowerCase()}.us`;
    const response = await fetch(
      `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`,
      {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return {};

    const text = await response.text();
    const [headerLine, rowLine] = text.trim().split(/\r?\n/);
    if (!headerLine || !rowLine || rowLine.includes("N/D")) return {};

    const headers = headerLine.split(",");
    const values = rowLine.split(",");
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    const price = Number(row.Close);

    return {
      price: isFinite(price) ? price : undefined,
      currency: "USD",
    };
  } catch {
    return {};
  }
}

// ============================================================
// 한국 주식: Daum Finance (시세) + DART (재무제표)
// ============================================================
async function fetchKrQuote(code: string): Promise<{
  price?: number;
  market_cap?: number;
  name?: string;
  market?: string;
}> {
  try {
    const response = await fetch(
      `https://finance.daum.net/api/search/quotes?q=${encodeURIComponent(code)}&limit=5`,
      {
        headers: {
          "User-Agent": UA,
          "Referer": "https://finance.daum.net/",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!response.ok) return {};
    const data = (await response.json()) as { quotes?: KoreanQuote[] };
    const quotes = data.quotes ?? [];

    const q = quotes.find((item) => {
      const sym = (item.symbolCode ?? "").replace(/^A/, "");
      return sym === code && item.isStock && !item.isDelisted;
    });
    if (!q) return {};

    const price: number | undefined = q.tradePrice;
    const shares: number | undefined = q.listedShareCount;
    const market_cap =
      price !== undefined && shares !== undefined
        ? price * shares
        : undefined;

    return { price, market_cap, name: q.name, market: q.market ?? "KRX" };
  } catch {
    return {};
  }
}

const DART_BASE = "https://opendart.fss.or.kr/api";
const REPORT_CODES: [string, string][] = [
  ["11011", "사업보고서"],
  ["11014", "3분기보고서"],
  ["11012", "반기보고서"],
  ["11013", "1분기보고서"],
];
const ACCOUNT_PATTERNS: Record<string, string[]> = {
  equity: ["자본총계"],
  net_income: ["당기순이익", "당기순이익(손실)", "연결당기순이익"],
  operating_income: ["영업이익", "영업이익(손실)"],
  total_liabilities: ["부채총계"],
};

function toNumber(s: unknown): number | undefined {
  if (s === null || s === undefined) return undefined;
  if (typeof s === "number") return isNaN(s) ? undefined : s;
  const txt = String(s).replace(/,/g, "").trim();
  if (!txt || txt === "-") return undefined;
  const n = parseFloat(txt);
  return isNaN(n) ? undefined : n;
}

function matchAccount(
  items: DartAccount[],
  patterns: string[]
): number | undefined {
  // 완전 일치 우선
  for (const item of items) {
    if (item.account_nm && patterns.includes(item.account_nm)) {
      return toNumber(item.thstrm_amount);
    }
  }
  // 부분 일치
  for (const p of patterns) {
    for (const item of items) {
      if ((item.account_nm ?? "").includes(p)) {
        return toNumber(item.thstrm_amount);
      }
    }
  }
  return undefined;
}

async function fetchDartFinancials(stockCode: string): Promise<FinancialData> {
  const apiKey = process.env.DART_API_KEY?.trim();
  if (!apiKey) return { source: "dart_no_api_key" };

  // corp_code 조회
  let corpCode: string | undefined;
  try {
    const row = await db.execute({
      sql: "SELECT corp_code FROM corp_codes WHERE stock_code = ?",
      args: [stockCode.padStart(6, "0")],
    });
    corpCode = row.rows?.[0]?.[0] as string | undefined;
  } catch {
    return { source: "dart_db_error" };
  }
  if (!corpCode) return { source: "corp_code_not_found" };

  const out: FinancialData = { source: "dart_not_found" };
  const year = new Date().getFullYear();

  for (const tryYear of [year, year - 1]) {
    for (const [rcode] of REPORT_CODES) {
      for (const fsDiv of ["CFS", "OFS"]) {
        try {
          const params = new URLSearchParams({
            crtfc_key: apiKey,
            corp_code: corpCode,
            bsns_year: String(tryYear),
            reprt_code: rcode,
            fs_div: fsDiv,
          });
          const r = await fetch(
            `${DART_BASE}/fnlttSinglAcntAll.json?${params}`,
            { signal: AbortSignal.timeout(10000) }
          );
          const data = (await r.json()) as {
            status?: string;
            list?: DartAccount[];
          };

          if (data.status !== "000") continue;
          const items = data.list ?? [];
          if (!items.length) continue;

          for (const [key, patterns] of Object.entries(ACCOUNT_PATTERNS)) {
            const field = key as keyof Pick<
              FinancialData,
              "equity" | "net_income" | "operating_income" | "total_liabilities"
            >;
            if (out[field] === undefined) {
              const val = matchAccount(items, patterns);
              if (val !== undefined) out[field] = val;
            }
          }

          out.bsns_year = String(tryYear);
          out.report_code = rcode;
          out.source = `${fsDiv}/${rcode}/${tryYear}`;

          if (out.equity !== undefined && out.net_income !== undefined) {
            return out;
          }
          break; // 이 rcode에서 CFS hit했지만 미완성 → 다음 rcode 시도
        } catch {
          continue;
        }
      }
    }
  }

  return out;
}

// ============================================================
// 공통 유틸
// ============================================================
function safeDiv(
  a: number | null | undefined,
  b: number | null | undefined
): number | null {
  if (a === null || a === undefined || b === null || b === undefined || b === 0) {
    return null;
  }
  const r = a / b;
  return isFinite(r) ? r : null;
}

async function getTodayCachedAnalysis(
  code: string,
  country: "KR" | "US"
): Promise<AnalysisResult | null> {
  try {
    const result = await db.execute({
      sql: `SELECT
              w.name,
              w.market,
              f.price,
              f.market_cap,
              f.equity,
              f.net_income,
              f.operating_income,
              f.total_liabilities,
              f.roe,
              f.pbr,
              f.per,
              f.debt_ratio,
              f.source
            FROM financials f
            LEFT JOIN watchlist w ON f.code = w.code
            WHERE f.code = ?
              AND f.country = ?
              AND f.data_date = DATE('now')
              AND (f.roe IS NOT NULL OR f.pbr IS NOT NULL)
            ORDER BY f.collected_at DESC
            LIMIT 1`,
      args: [code, country],
    });

    const row = result.rows[0];
    if (!row) return null;

    return {
      ok: true,
      code,
      country,
      currency: country === "KR" ? "KRW" : "USD",
      name: typeof row.name === "string" ? row.name : null,
      market: typeof row.market === "string" ? row.market : null,
      price: typeof row.price === "number" ? row.price : null,
      market_cap: typeof row.market_cap === "number" ? row.market_cap : null,
      equity: typeof row.equity === "number" ? row.equity : null,
      net_income: typeof row.net_income === "number" ? row.net_income : null,
      operating_income:
        typeof row.operating_income === "number" ? row.operating_income : null,
      total_liabilities:
        typeof row.total_liabilities === "number" ? row.total_liabilities : null,
      per: typeof row.per === "number" ? row.per : null,
      pbr: typeof row.pbr === "number" ? row.pbr : null,
      roe: typeof row.roe === "number" ? row.roe : null,
      debt_ratio: typeof row.debt_ratio === "number" ? row.debt_ratio : null,
      source: {
        ...parseSource(row.source),
        cache: "db_today",
      },
    };
  } catch {
    return null;
  }
}

// ============================================================
// POST /api/analyze
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const { code, save_to_db, force_refresh } = (await request.json()) as {
      code?: string;
      save_to_db?: boolean;
      force_refresh?: boolean;
    };

    const rawCode = code?.trim();
    if (!rawCode) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const isKr = /^\d{6}$/.test(rawCode);
    const country: "KR" | "US" = isKr ? "KR" : "US";
    const normalizedCode = isKr ? rawCode : rawCode.toUpperCase();

    if (save_to_db && !force_refresh) {
      const cached = await getTodayCachedAnalysis(normalizedCode, country);
      if (cached) return NextResponse.json(cached);
    }

    const result: AnalysisResult = {
      ok: true,
      code: normalizedCode,
      country,
      currency: isKr ? "KRW" : "USD",
      name: null,
      market: null,
      price: null,
      market_cap: null,
      equity: null,
      net_income: null,
      operating_income: null,
      total_liabilities: null,
      per: null,
      pbr: null,
      roe: null,
      debt_ratio: null,
      source: {},
    };

    if (isKr) {
      // 한국 종목: Daum Finance(시세) + DART(재무제표)
      const quote = await fetchKrQuote(normalizedCode);
      result.price = quote.price ?? null;
      result.market_cap = quote.market_cap ?? null;
      result.name = quote.name ?? null;
      result.market = quote.market ?? null;
      result.source.market = "daum";

      const fin = await fetchDartFinancials(normalizedCode);
      result.equity = fin.equity ?? null;
      result.net_income = fin.net_income ?? null;
      result.operating_income = fin.operating_income ?? null;
      result.total_liabilities = fin.total_liabilities ?? null;
      result.source.financials = fin.source;
      if (fin.bsns_year) result.bsns_year = fin.bsns_year;
      if (fin.report_code) result.report_code = fin.report_code;
    } else {
      // 미국 종목: SEC XBRL(재무제표) + Stooq(업데이트 시점 시세)
      const fin = await fetchUsFinancials(normalizedCode);
      result.equity = fin.equity ?? null;
      result.net_income = fin.net_income ?? null;
      result.operating_income = fin.operating_income ?? null;
      result.total_liabilities = fin.total_liabilities ?? null;
      result.source.financials = fin.source;
      if (fin.fiscal_year) result.bsns_year = fin.fiscal_year;
      if (fin.form) result.report_code = fin.form;

      const quote = await fetchUsQuote(normalizedCode);
      result.price = quote.price ?? null;
      result.market_cap =
        quote.price !== undefined && fin.shares_outstanding !== undefined
          ? quote.price * fin.shares_outstanding
          : null;
      result.source.market = "stooq";
      if (quote.currency) result.currency = quote.currency;
    }

    // 지표 계산
    result.per = safeDiv(result.market_cap, result.net_income);
    result.pbr = safeDiv(result.market_cap, result.equity);

    const roe = safeDiv(result.net_income, result.equity);
    result.roe = roe !== null ? roe * 100 : null;

    const dr = safeDiv(result.total_liabilities, result.equity);
    result.debt_ratio = dr !== null ? dr * 100 : null;

    // DB 저장 (옵션)
    if (save_to_db && (result.roe !== null || result.pbr !== null)) {
      try {
        const validateNum = (n: number | null) => {
          if (n === null || n === undefined) return null;
          if (!isFinite(n)) return null;
          return n;
        };

        await db.execute({
          sql: `INSERT INTO financials
               (code, country, data_date, price, market_cap, equity, net_income,
                operating_income, total_liabilities, roe, pbr, per, debt_ratio, source, collected_at)
               VALUES (?, ?, DATE('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(code, country, data_date) DO UPDATE SET
                 price = excluded.price,
                 market_cap = excluded.market_cap,
                 equity = excluded.equity,
                 net_income = excluded.net_income,
                 operating_income = excluded.operating_income,
                 total_liabilities = excluded.total_liabilities,
                 roe = excluded.roe,
                 pbr = excluded.pbr,
                 per = excluded.per,
                 debt_ratio = excluded.debt_ratio,
                 source = excluded.source,
                 collected_at = CURRENT_TIMESTAMP`,
          args: [
            normalizedCode,
            country,
            validateNum(result.price),
            validateNum(result.market_cap),
            validateNum(result.equity),
            validateNum(result.net_income),
            validateNum(result.operating_income),
            validateNum(result.total_liabilities),
            validateNum(result.roe),
            validateNum(result.pbr),
            validateNum(result.per),
            validateNum(result.debt_ratio),
            JSON.stringify(result.source),
          ],
        });
      } catch (dbError) {
        console.warn("DB save error:", dbError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { ok: false, error: "Analysis failed" },
      { status: 500 }
    );
  }
}
