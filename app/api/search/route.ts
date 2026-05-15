import { NextRequest, NextResponse } from "next/server";

interface Stock {
  code: string;
  name: string;
  market: string;
  country: string;
  price?: number;
  marcap?: number;
}

// 한국 종목 검색 (Daum Finance)
async function searchKorean(keyword: string, limit: number = 20): Promise<Stock[]> {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  try {
    const response = await fetch(
      `https://finance.daum.net/api/search/quotes?q=${encodeURIComponent(
        keyword
      )}&limit=${limit}`,
      {
        headers: {
          "User-Agent": ua,
          Referer: "https://finance.daum.net/",
        },
        timeout: 10000,
      }
    );

    if (!response.ok) return [];
    const data = await response.json();

    const rows: Stock[] = [];
    for (const q of data.quotes || []) {
      if (!q.isStock || q.isDelisted) continue;

      const sym = (q.symbolCode || "").replace(/^A/, "");
      if (!/^\d{6}$/.test(sym)) continue;

      const name = q.name || "";
      if (!name) continue;

      rows.push({
        code: sym,
        name,
        market: q.market || "KRX",
        country: "KR",
        price: q.tradePrice,
        marcap:
          q.tradePrice && q.listedShareCount
            ? q.tradePrice * q.listedShareCount
            : undefined,
      });
    }

    return rows.slice(0, limit);
  } catch {
    return [];
  }
}

// 미국 종목 검색 (NASDAQ Trader)
let usCache: Stock[] | null = null;

async function fetchUsListings(): Promise<Stock[]> {
  if (usCache) return usCache;

  const rows: Stock[] = [];
  const sources = [
    {
      url: "https://nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
      market: "NASDAQ",
    },
    {
      url: "https://nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
      market: "NYSE",
    },
  ];

  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { "User-Agent": ua },
        timeout: 15000,
      });

      if (!response.ok) continue;

      const text = await response.text();
      const lines = text.split("\n");
      if (!lines.length) continue;

      const header = lines[0].split("|");

      for (const line of lines.slice(1)) {
        if (!line || line.startsWith("File Creation")) continue;

        const parts = line.split("|");
        if (parts.length < 2) continue;

        const row: Record<string, string> = {};
        header.forEach((h, i) => {
          row[h] = parts[i] || "";
        });

        const symbol = (row["Symbol"] || row["ACT Symbol"] || "").trim();
        const name = (row["Security Name"] || "").trim();

        if (!symbol || !name) continue;
        if (row["Test Issue"] === "Y") continue;
        if (/[\$\.=]/.test(symbol)) continue;

        const exch = row["Exchange"] || "";
        let market = source.market;
        if (exch === "N") market = "NYSE";
        else if (exch === "A") market = "AMEX";
        else if (exch === "Q") market = "NASDAQ";

        rows.push({
          code: symbol,
          name,
          market,
          country: "US",
        });
      }
    } catch {
      continue;
    }
  }

  usCache = rows;
  return rows;
}

async function searchUs(keyword: string, limit: number = 20): Promise<Stock[]> {
  const kw = (keyword || "").trim().toLowerCase();
  if (!kw) return [];

  const listings = await fetchUsListings();
  const matches: [number, Stock][] = [];

  for (const row of listings) {
    const codeLower = row.code.toLowerCase();
    const nameLower = row.name.toLowerCase();

    let score: number;
    if (kw === codeLower) {
      score = 0;
    } else if (codeLower.startsWith(kw)) {
      score = 1;
    } else if (codeLower.includes(kw)) {
      score = 2;
    } else if (nameLower.startsWith(kw)) {
      score = 3;
    } else if (nameLower.includes(kw)) {
      score = 4;
    } else {
      continue;
    }

    const nameL = nameLower;
    if (
      [" etf", "yieldmax", "leverage", "daily bull", "daily bear", "short ", " 2x", " 3x"].some((t) => nameL.includes(t))
    ) {
      score += 10;
    }

    matches.push([score, row]);
  }

  matches.sort((a, b) => a[0] - b[0]);
  return matches.slice(0, limit).map((m) => m[1]);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    );
  }

  // 한국 종목과 미국 종목 동시 검색
  const [krResults, usResults] = await Promise.all([
    searchKorean(q, 20),
    searchUs(q, 20),
  ]);

  // 결과 합병 (한국 먼저)
  const results = [...krResults, ...usResults];

  return NextResponse.json({ results });
}

