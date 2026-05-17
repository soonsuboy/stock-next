"use client";

import { useEffect, useState } from "react";

interface Stock {
  code: string;
  name: string;
  market: string;
  country: string;
  price?: number | null;
  marcap?: number | null;
}

interface RankedStock extends Stock {
  market_cap?: number | null;
  equity?: number | null;
  net_income?: number | null;
  roe?: number | null;
  per?: number | null;
  pbr?: number | null;
  collected_at?: string | null;
}

type SortKey = "market_cap" | "roe" | "per" | "pbr" | "price";

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "market_cap", label: "시가총액 높은 순" },
  { key: "roe", label: "ROE 높은 순" },
  { key: "per", label: "PER 낮은 순" },
  { key: "pbr", label: "PBR 낮은 순" },
  { key: "price", label: "가격 높은 순" },
];

const formatCurrency = (
  value: number | null | undefined,
  country: string,
  compact = true
) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: country === "KR" ? "KRW" : "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: country === "KR" ? 0 : 2,
  }).format(value);
};

const formatMetric = (value: number | null | undefined, suffix = "") => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)}${suffix}`;
};

function countryLabel(country: string) {
  return country === "KR" ? "한국" : "미국";
}

function stockKey(stock: Stock) {
  return `${stock.country}:${stock.code}`;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedStocks, setAddedStocks] = useState<Set<string>>(new Set());
  const [rankSort, setRankSort] = useState<SortKey>("market_cap");
  const [ranked, setRanked] = useState<{ KR: RankedStock[]; US: RankedStock[] }>(
    { KR: [], US: [] }
  );
  const [rankLoading, setRankLoading] = useState(true);
  const [rankError, setRankError] = useState("");

  const fetchRanked = async (sort: SortKey) => {
    setRankLoading(true);
    setRankError("");
    try {
      const response = await fetch(`/api/search/ranked?sort=${sort}&limit=30`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "집계 기업 조회 실패");
      }
      setRanked(data.results || { KR: [], US: [] });
    } catch (err) {
      setRankError(err instanceof Error ? err.message : "집계 기업 조회 중 오류 발생");
    } finally {
      setRankLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchRanked(rankSort);
    });
  }, [rankSort]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("검색 실패");

      const data = await response.json();
      setResults(data.results || []);

      if (!data.results || data.results.length === 0) {
        setError("검색 결과가 없습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async (stock: Stock) => {
    const key = stockKey(stock);
    if (addedStocks.has(key)) return;

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stock),
      });

      if (!response.ok) throw new Error("추가 실패");

      setAddedStocks(new Set([...addedStocks, key]));
      alert(`${stock.name}을(를) 관심 종목에 추가했습니다.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "추가 중 오류 발생");
    }
  };

  const renderAddButton = (stock: Stock) => (
    <button
      onClick={() => handleAddStock(stock)}
      disabled={addedStocks.has(stockKey(stock))}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        addedStocks.has(stockKey(stock))
          ? "cursor-not-allowed bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
    >
      {addedStocks.has(stockKey(stock)) ? "추가됨" : "추가"}
    </button>
  );

  const renderRankedGrid = (country: "KR" | "US", stocks: RankedStock[]) => (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {countryLabel(country)} 집계 기업
        </h3>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {stocks.length}개
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {stocks.map((stock) => (
          <div
            key={`${country}:${stock.code}`}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  {stock.name}
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {stock.code} · {stock.market}
                </p>
              </div>
              {renderAddButton(stock)}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">시가총액</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(stock.market_cap, country)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">가격</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(stock.price, country, false)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">ROE</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {formatMetric(stock.roe, "%")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">PER / PBR</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {formatMetric(stock.per)} / {formatMetric(stock.pbr)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-8 text-4xl font-bold text-slate-900 dark:text-white">
        종목 검색
      </h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        검색 결과는 배치가 DB에 적재한 기업 목록에서만 조회합니다.
      </p>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="종목명 또는 코드 입력 (예: 005930, 삼성전자, AAPL)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "검색 중..." : "검색"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mb-10 space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            검색 결과 ({results.length}개)
          </h2>
          {results.map((stock) => (
            <div
              key={`${stock.code}-${stock.country}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {stock.name}
                </h3>
                <div className="mt-1 flex gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    {stock.code} ({stock.market})
                  </span>
                  <span>{countryLabel(stock.country)}</span>
                  {stock.price && <span>{stock.price.toLocaleString()}</span>}
                </div>
              </div>
              {renderAddButton(stock)}
            </div>
          ))}
        </div>
      )}

      {!loading && query && results.length === 0 && !error && (
        <div className="py-12 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            검색 결과가 없습니다. 다시 시도해주세요.
          </p>
        </div>
      )}

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            집계된 기업 보기
          </h2>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRankSort(option.key)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  rankSort === option.key
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {rankError && (
          <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
            {rankError}
          </div>
        )}

        {rankLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            집계 기업을 불러오는 중...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {renderRankedGrid("KR", ranked.KR || [])}
            {renderRankedGrid("US", ranked.US || [])}
          </div>
        )}
      </section>
    </div>
  );
}
