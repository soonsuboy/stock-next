import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
  "User-Agent": "stock-analyzer/0.1 contact@example.com",
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

type SecFacts = Record<string, Record<string, SecConcept> | undefined>;

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

function latestAnnualFact(
  facts: SecFacts | undefined,
  taxonomy: "us-gaap" | "dei",
  concepts: string[],
  units: string[]
): SecFact | undefined {
  const candidates: SecFact[] = [];

  for (const concept of concepts) {
    const unitBlock = facts?.[taxonomy]?.[concept]?.units;
    if (!unitBlock) continue;

    for (const unit of units) {
      const rows: SecFact[] = unitBlock[unit] ?? [];
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
  }

  candidates.sort((a, b) => {
    const aDate = `${a.filed ?? ""}-${a.end ?? ""}`;
    const bDate = `${b.filed ?? ""}-${b.end ?? ""}`;
    return bDate.localeCompare(aDate);
  });

  return candidates[0];
}

async function fetchUsFinancials(symbol: string): Promise<FinancialData> {
  try {
    const cik = await lookupCik(symbol);
    if (!cik) return { source: "sec_cik_not_found" };

    const paddedCik = String(cik).padStart(10, "0");
    const response = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`,
      {
        headers: SEC_HEADERS,
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) return { source: "sec_error" };

    const data = (await response.json()) as { facts?: SecFacts };
    const facts = data.facts;

    const equity = latestAnnualFact(facts, "us-gaap", [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ], ["USD"]);
    const netIncome = latestAnnualFact(facts, "us-gaap", [
      "NetIncomeLoss",
      "ProfitLoss",
      "NetIncomeLossAvailableToCommonStockholdersBasic",
    ], ["USD"]);
    const operatingIncome = latestAnnualFact(facts, "us-gaap", [
      "OperatingIncomeLoss",
    ], ["USD"]);
    const liabilities = latestAnnualFact(facts, "us-gaap", [
      "Liabilities",
      "LiabilitiesCurrent",
    ], ["USD"]);
    const shares = latestAnnualFact(facts, "dei", [
      "EntityCommonStockSharesOutstanding",
    ], ["shares"]);

    const anchor = equity ?? netIncome ?? operatingIncome ?? liabilities;
    const out: FinancialData = {
      equity: equity?.val,
      net_income: netIncome?.val,
      operating_income: operatingIncome?.val,
      total_liabilities: liabilities?.val,
      shares_outstanding: shares?.val,
      fiscal_year: anchor?.fy ? String(anchor.fy) : undefined,
      form: anchor?.form,
      source: `sec/${paddedCik}`,
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

// ============================================================
// POST /api/analyze
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const { code, save_to_db } = (await request.json()) as {
      code?: string;
      save_to_db?: boolean;
    };

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const isKr = /^\d{6}$/.test(code);
    const country: "KR" | "US" = isKr ? "KR" : "US";

    const result: AnalysisResult = {
      ok: true,
      code,
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
      const quote = await fetchKrQuote(code);
      result.price = quote.price ?? null;
      result.market_cap = quote.market_cap ?? null;
      result.name = quote.name ?? null;
      result.market = quote.market ?? null;
      result.source.market = "daum";

      const fin = await fetchDartFinancials(code);
      result.equity = fin.equity ?? null;
      result.net_income = fin.net_income ?? null;
      result.operating_income = fin.operating_income ?? null;
      result.total_liabilities = fin.total_liabilities ?? null;
      result.source.financials = fin.source;
      if (fin.bsns_year) result.bsns_year = fin.bsns_year;
      if (fin.report_code) result.report_code = fin.report_code;
    } else {
      // 미국 종목: SEC XBRL(재무제표) + Stooq(업데이트 시점 시세)
      const fin = await fetchUsFinancials(code);
      result.equity = fin.equity ?? null;
      result.net_income = fin.net_income ?? null;
      result.operating_income = fin.operating_income ?? null;
      result.total_liabilities = fin.total_liabilities ?? null;
      result.source.financials = fin.source;
      if (fin.fiscal_year) result.bsns_year = fin.fiscal_year;
      if (fin.form) result.report_code = fin.form;

      const quote = await fetchUsQuote(code);
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
            code,
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
