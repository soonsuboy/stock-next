"use client";

import { useEffect, useState } from "react";

interface Stock {
  code: string;
  name: string;
  market: string;
  country: string;
  price?: number | null;
  previous_close?: number | null;
  change_rate?: number | null;
  marcap?: number | null;
}

interface RankedStock extends Stock {
  gics_sector?: string | null;
  market_cap?: number | null;
  equity?: number | null;
  net_income?: number | null;
  roe?: number | null;
  per?: number | null;
  pbr?: number | null;
  collected_at?: string | null;
}

type SortKey = "market_cap" | "roe" | "per" | "pbr" | "price";
type RankFilter = "all" | "limit_up" | "limit_down";
type Country = "KR" | "US";

interface RankedPage {
  items: RankedStock[];
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 30;

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "market_cap", label: "시가총액 높은 순" },
  { key: "roe", label: "ROE 높은 순" },
  { key: "per", label: "PER 낮은 순" },
  { key: "pbr", label: "PBR 낮은 순" },
  { key: "price", label: "가격 높은 순" },
];

const filterOptions: Array<{ key: RankFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "limit_up", label: "상한가 +28% 이상" },
  { key: "limit_down", label: "하한가 -28% 이하" },
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

const formatChangeRate = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

function countryLabel(country: string) {
  return country === "KR" ? "한국" : "미국";
}

function stockKey(stock: Stock) {
  return `${stock.country}:${stock.code}`;
}

function ChangeRateBadge({ value }: { value: number | null | undefined }) {
  const tone =
    value === null || value === undefined || value === 0
      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      : value > 0
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200";

  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${tone}`}>
      {formatChangeRate(value)}
    </span>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedStocks, setAddedStocks] = useState<Set<string>>(new Set());
  const [rankSort, setRankSort] = useState<SortKey>("market_cap");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [rankCountry, setRankCountry] = useState<Country>("KR");
  const [rankPage, setRankPage] = useState(1);
  const [ranked, setRanked] = useState<RankedPage>({
    items: [],
    total: 0,
    totalPages: 1,
  });
  const [selectedStocks, setSelectedStocks] = useState<Record<string, Stock>>(
    {}
  );
  const [rankLoading, setRankLoading] = useState(true);
  const [rankError, setRankError] = useState("");

  const fetchRanked = async (
    sort: SortKey,
    filter: RankFilter,
    country: Country,
    page: number
  ) => {
    setRankLoading(true);
    setRankError("");
    try {
      const params = new URLSearchParams({
        sort,
        filter,
        country,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(
        `/api/search/ranked?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "집계 기업 조회 실패");
      }
      setRanked({
        items: data.results || [],
        total: Number(data.total || 0),
        totalPages: Number(data.totalPages || 1),
      });
    } catch (err) {
      setRankError(err instanceof Error ? err.message : "집계 기업 조회 중 오류 발생");
    } finally {
      setRankLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchRanked(rankSort, rankFilter, rankCountry, rankPage);
    });
  }, [rankSort, rankFilter, rankCountry, rankPage]);

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

  const addStockRequest = async (stock: Stock) => {
    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stock),
    });

    if (response.status === 409) return "duplicate" as const;

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "추가 실패");
    }

    return "added" as const;
  };

  const handleAddStock = async (stock: Stock) => {
    const key = stockKey(stock);
    if (addedStocks.has(key)) return;

    try {
      const result = await addStockRequest(stock);
      setAddedStocks((current) => new Set([...current, key]));
      alert(
        result === "duplicate"
          ? `${stock.name}은(는) 이미 관심 종목에 있습니다.`
          : `${stock.name}을(를) 관심 종목에 추가했습니다.`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "추가 중 오류 발생");
    }
  };

  const handleBulkAddStocks = async () => {
    const selected = Object.values(selectedStocks).filter(
      (stock) => !addedStocks.has(stockKey(stock))
    );
    if (selected.length === 0) {
      alert("관심종목에 추가할 종목을 선택해주세요.");
      return;
    }

    let added = 0;
    let duplicate = 0;
    const failed: string[] = [];
    const nextAdded = new Set(addedStocks);

    for (const stock of selected) {
      const key = stockKey(stock);
      try {
        const result = await addStockRequest(stock);
        nextAdded.add(key);
        if (result === "duplicate") {
          duplicate += 1;
        } else {
          added += 1;
        }
      } catch (err) {
        failed.push(
          `${stock.name}: ${err instanceof Error ? err.message : "추가 실패"}`
        );
      }
    }

    setAddedStocks(nextAdded);
    setSelectedStocks((current) => {
      const next = { ...current };
      for (const stock of selected) {
        delete next[stockKey(stock)];
      }
      return next;
    });

    const summary = [
      added > 0 ? `추가 ${added}개` : "",
      duplicate > 0 ? `이미 있음 ${duplicate}개` : "",
      failed.length > 0 ? `실패 ${failed.length}개` : "",
    ]
      .filter(Boolean)
      .join(", ");
    alert(summary || "처리할 종목이 없습니다.");
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

  const selectableRanked = ranked.items.filter(
    (stock) => !addedStocks.has(stockKey(stock))
  );
  const allVisibleSelected =
    selectableRanked.length > 0 &&
    selectableRanked.every((stock) => selectedStocks[stockKey(stock)]);
  const selectedCount = Object.keys(selectedStocks).length;
  const rankedStart = ranked.total === 0 ? 0 : (rankPage - 1) * PAGE_SIZE + 1;
  const rankedEnd = Math.min(rankPage * PAGE_SIZE, ranked.total);
  const pageStart = Math.max(1, Math.min(rankPage - 2, ranked.totalPages - 4));
  const pageEnd = Math.min(ranked.totalPages, pageStart + 4);
  const pageNumbers = Array.from(
    { length: pageEnd - pageStart + 1 },
    (_, index) => pageStart + index
  );

  const toggleRankedStock = (stock: RankedStock) => {
    const key = stockKey(stock);
    if (addedStocks.has(key)) return;

    setSelectedStocks((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = stock;
      }
      return next;
    });
  };

  const toggleRankedPageSelection = () => {
    setSelectedStocks((current) => {
      const next = { ...current };
      if (allVisibleSelected) {
        for (const stock of selectableRanked) {
          delete next[stockKey(stock)];
        }
      } else {
        for (const stock of selectableRanked) {
          next[stockKey(stock)] = stock;
        }
      }
      return next;
    });
  };

  const handleRankCountryChange = (country: Country) => {
    setRankCountry(country);
    setRankPage(1);
  };

  const handleRankSortChange = (sort: SortKey) => {
    setRankSort(sort);
    setRankPage(1);
  };

  const handleRankFilterChange = (filter: RankFilter) => {
    setRankFilter(filter);
    setRankPage(1);
  };

  const renderRankedTable = () => (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="집계 기업 시장 선택"
          className="inline-flex rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
        >
          {(["KR", "US"] as const).map((country) => (
            <button
              key={country}
              type="button"
              role="tab"
              aria-selected={rankCountry === country}
              onClick={() => handleRankCountryChange(country)}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                rankCountry === country
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {countryLabel(country)} 주식
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleBulkAddStocks}
          disabled={selectedCount === 0}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          선택 {selectedCount}개 관심종목 추가
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
        <span>
          총 {ranked.total.toLocaleString()}개 중 {rankedStart.toLocaleString()}-
          {rankedEnd.toLocaleString()}개 표시
        </span>
        <span>페이지당 {PAGE_SIZE}개</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th className="w-12 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={selectableRanked.length === 0}
                  onChange={toggleRankedPageSelection}
                  aria-label="현재 페이지 종목 전체 선택"
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              <th className="px-3 py-3 text-left">기업명</th>
              <th className="px-3 py-3 text-left">섹터</th>
              <th className="px-3 py-3 text-right">시가총액</th>
              <th className="px-3 py-3 text-right">ROE</th>
              <th className="px-3 py-3 text-right">PBR</th>
              <th className="px-3 py-3 text-right">PER</th>
              <th className="px-3 py-3 text-right">가격</th>
              <th className="px-3 py-3 text-right">전일가격</th>
              <th className="px-3 py-3 text-right">등락률</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {ranked.items.map((stock) => {
              const key = stockKey(stock);
              const isAdded = addedStocks.has(key);
              const isSelected = Boolean(selectedStocks[key]);

              return (
                <tr
                  key={key}
                  className="transition hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAdded}
                      onChange={() => toggleRankedStock(stock)}
                      aria-label={`${stock.name} 선택`}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {stock.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {stock.code} · {stock.market}
                      {isAdded && " · 추가됨"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700 dark:text-slate-200">
                    {stock.gics_sector || "미분류"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(stock.market_cap, rankCountry)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatMetric(stock.roe, "%")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatMetric(stock.pbr)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatMetric(stock.per)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(stock.price, rankCountry, false)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatCurrency(stock.previous_close, rankCountry, false)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <ChangeRateBadge value={stock.change_rate} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ranked.items.length === 0 && (
          <div className="p-8 text-center text-slate-600 dark:text-slate-300">
            조건에 맞는 집계 기업이 없습니다.
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setRankPage((page) => Math.max(1, page - 1))}
          disabled={rankPage <= 1}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          이전
        </button>
        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => setRankPage(page)}
            className={`min-w-10 rounded px-3 py-2 text-sm font-bold transition ${
              rankPage === page
                ? "bg-blue-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            setRankPage((page) => Math.min(ranked.totalPages, page + 1))
          }
          disabled={rankPage >= ranked.totalPages}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          다음
        </button>
      </div>
    </div>
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
                  {stock.price && (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>
                        {formatCurrency(stock.price, stock.country, false)}
                      </span>
                      <ChangeRateBadge value={stock.change_rate} />
                    </span>
                  )}
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
                onClick={() => handleRankSortChange(option.key)}
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
        <div className="mb-5 flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleRankFilterChange(option.key)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                rankFilter === option.key
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
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
          renderRankedTable()
        )}
      </section>
    </div>
  );
}
