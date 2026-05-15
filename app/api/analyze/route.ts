import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface FinancialData {
  equity?: number;
  net_income?: number;
  operating_income?: number;
  total_liabilities?: number;
  source?: string;
}

// Yahoo Finance에서 데이터 가져오기 (미국 종목용)
async function fetchUsFinancials(symbol: string): Promise<FinancialData> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=incomeStatementHistory,balanceSheetHistory`,
      {
        headers: { "User-Agent": UA },
        timeout: 15000,
      }
    );

    if (!response.ok) return { source: "yahoo_error" };

    const data = await response.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return { source: "yahoo_error" };

    const out: FinancialData = { source: "yahoo" };

    const income = result.incomeStatementHistory?.incomeStatementHistory?.[0];
    if (income) {
      out.net_income = income.netIncome?.raw;
      out.operating_income = income.operatingIncome?.raw;
    }

    const balance = result.balanceSheetHistory?.balanceSheetStatements?.[0];
    if (balance) {
      out.equity = balance.totalStockholderEquity?.raw;
      out.total_liabilities = balance.totalLiab?.raw;
    }

    return out;
  } catch {
    return { source: "yahoo_error" };
  }
}

// Yahoo Finance에서 주가 데이터
async function fetchUsQuote(
  symbol: string
): Promise<{ price?: number; market_cap?: number }> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`,
      {
        headers: { "User-Agent": UA },
        timeout: 10000,
      }
    );

    if (!response.ok) return {};

    const data = await response.json();
    const price = data?.quoteSummary?.result?.[0]?.price;

    return {
      price: price?.regularMarketPrice?.raw,
      market_cap: price?.marketCap?.raw,
    };
  } catch {
    return {};
  }
}

function safeDiv(a: number | undefined, b: number | undefined): number | null {
  if (a === undefined || b === undefined || b === 0) return null;
  try {
    return a / b;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code, save_to_db } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const isKr = /^\d{6}$/.test(code);
    const country = isKr ? "KR" : "US";

    const result: Record<string, any> = {
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
      // 한국 종목: DART는 복잡하므로, 현재는 간단한 처리만
      result.source.market = "daum";
      result.source.financials = "dart_pending";
    } else {
      // 미국 종목
      const quote = await fetchUsQuote(code);
      result.price = quote.price;
      result.market_cap = quote.market_cap;
      result.source.market = "yahoo";

      const fin = await fetchUsFinancials(code);
      result.equity = fin.equity;
      result.net_income = fin.net_income;
      result.operating_income = fin.operating_income;
      result.total_liabilities = fin.total_liabilities;
      result.source.financials = fin.source;
    }

    // 지표 계산
    result.per = safeDiv(result.market_cap, result.net_income);
    result.pbr = safeDiv(result.market_cap, result.equity);

    const roe = safeDiv(result.net_income, result.equity);
    result.roe = roe !== null ? roe * 100 : null;

    const dr = safeDiv(result.total_liabilities, result.equity);
    result.debt_ratio = dr !== null ? dr * 100 : null;

    // DB에 저장 (옵션)
    if (save_to_db && (result.roe !== null || result.pbr !== null)) {
      try {
        // NaN/Infinity 검증
        const validateNum = (n: number | null) => {
          if (n === null || n === undefined) return null;
          if (!isFinite(n)) return null;
          return n;
        };

        const saveData = [
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
        ];

        await db.execute(
          `INSERT INTO financials 
           (code, country, data_date, price, market_cap, equity, net_income, 
            operating_income, total_liabilities, roe, pbr, per, debt_ratio, source, collected_at)
           VALUES (?, ?, DATE('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          saveData
        );
      } catch (dbError) {
        console.warn("DB save error:", dbError);
        // DB 저장 실패해도 결과는 반환
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
