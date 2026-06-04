"use client";

import { useEffect, useState } from "react";
import {
  clearClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

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

interface MacroIndicator {
  key: string;
  region: string;
  label: string;
  value: number | null;
  unit: string | null;
  displayValue: string;
  source: string | null;
  status: string;
  note: string | null;
  snapshotDate: string;
  createdAt: string | null;
}

interface MacroResponse {
  indicators: MacroIndicator[];
  updatedAt: string | null;
}

const PAGE_SIZE = 30;
const RANKED_CACHE_TTL_MS = 5 * 60 * 1000;
const MACRO_CACHE_KEY = "search:macro-indicators:v1";
const MACRO_CACHE_TTL_MS = 30 * 60 * 1000;
const WATCHLIST_CACHE_KEY = "watchlist:v1";
const ANALYSIS_CACHE_KEY = "analysis:v2";

function rankedCacheKey(
  sort: SortKey,
  filter: RankFilter,
  country: Country,
  page: number
) {
  return `search:ranked:v1:${country}:${sort}:${filter}:${page}`;
}

function clearWatchlistRelatedCache() {
  clearClientCache(WATCHLIST_CACHE_KEY);
  clearClientCache(ANALYSIS_CACHE_KEY);
}

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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MacroStatusBadge({ indicator }: { indicator: MacroIndicator }) {
  const isError = indicator.status === "error";
  const isFallback = indicator.status === "fallback";
  const isOverheated = indicator.status === "overheated";
  const isSurge = indicator.status === "surge";
  const isDown = indicator.status === "down";
  const isNetBuy = indicator.status === "net_buy";
  const isNetSell = indicator.status === "net_sell";
  const tone = isError
    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200"
    : isFallback
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200"
      : isOverheated || isSurge || isNetBuy
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200"
        : isDown || isNetSell
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200";
  const label = isError
    ? "수집 실패"
    : isFallback
      ? "대체값"
      : isOverheated
        ? "과열"
        : isSurge
          ? "폭증"
          : isDown
            ? "감소"
            : isNetBuy
              ? "순매수"
              : isNetSell
                ? "순매도"
        : "정상";

  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {label}
    </span>
  );
}

function FearGreedBar({ value }: { value: number | null }) {
  const score = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tone =
    value === null
      ? "bg-slate-300"
      : score < 45
        ? "bg-blue-500"
        : score < 55
          ? "bg-slate-500"
          : score < 75
            ? "bg-amber-500"
            : "bg-red-500";

  return (
    <div className="mt-3 h-2 rounded bg-slate-200 dark:bg-slate-800">
      <div className={`h-2 rounded ${tone}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function MacroIndicatorPanel({
  indicators,
  loading,
  error,
  updatedAt,
}: {
  indicators: MacroIndicator[];
  loading: boolean;
  error: string;
  updatedAt: string | null;
}) {
  const byKey = new Map(indicators.map((item) => [item.key, item]));
  const marketKeys = [
    "usd_krw",
    "seoul_fx_usd_volume",
    "kr_market_foreign_net_buy",
    "kr_market_foreign_net_buy_ratio",
    "kr_market_foreign_net_buy_change",
    "investor_deposit_total",
    "credit_loan_total",
    "credit_deposit_ratio",
    "fx_reserves_total",
    "fx_reserves_mom_change",
    "fx_reserves_mom_rate",
  ];
  const fearKeys = ["fear_greed_kr", "fear_greed_us", "fear_greed_btc"];

  const renderTile = (key: string) => {
    const indicator = byKey.get(key);
    if (!indicator) {
      return (
        <div
          key={key}
          className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {key}
          </div>
          <div className="mt-3 text-xl font-bold text-slate-400">-</div>
          <div className="mt-2 text-xs text-slate-500">수집 전</div>
        </div>
      );
    }

    const isRatio = indicator.key === "credit_deposit_ratio";
    const isFxVolume = indicator.key === "seoul_fx_usd_volume";
    const isFear = indicator.unit === "SCORE";
    const valueTone =
      (isRatio && indicator.status === "overheated") ||
      indicator.status === "surge" ||
      indicator.status === "net_buy"
        ? "text-red-700 dark:text-red-200"
        : indicator.status === "down" || indicator.status === "net_sell"
          ? "text-blue-700 dark:text-blue-200"
        : "text-slate-900 dark:text-white";

    return (
      <div
        key={indicator.key}
        className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {indicator.label}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              기준 {formatDate(indicator.snapshotDate)}
            </div>
          </div>
          <MacroStatusBadge indicator={indicator} />
        </div>
        <div className={`mt-3 text-2xl font-bold ${valueTone}`}>
          {indicator.displayValue}
        </div>
        {isFear && <FearGreedBar value={indicator.value} />}
        <div className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {isRatio
            ? "30% 이상이면 신용 과열구간으로 표시합니다."
            : isFxVolume
              ? "150억달러 이상이면 평시 거래량을 크게 상회한 것으로 표시합니다."
            : indicator.key === "kr_market_foreign_net_buy_ratio"
              ? "코스피+코스닥 거래대금 대비 외국인 순매수액 비율입니다."
            : indicator.key === "kr_market_foreign_net_buy_change"
              ? "전 거래일 대비 외국인 순매수액의 변화입니다."
            : indicator.source
              ? `출처: ${indicator.source}`
              : "출처 미확인"}
        </div>
      </div>
    );
  };

  return (
    <section className="mb-8 border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            오늘의 거시 지표
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            환율, 서울외환시장 거래량, 외환보유액, 국내시장 전체 외국인 수급, 예탁금·신용융자, 공포탐욕지수를 매일 배치로 갱신합니다.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          업데이트 {formatDateTime(updatedAt)}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && indicators.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-600 dark:text-slate-300">
          거시 지표를 불러오는 중...
        </div>
      ) : indicators.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-600 dark:text-slate-300">
          아직 수집된 거시 지표가 없습니다. 다음 배치 이후 표시됩니다.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {marketKeys.map(renderTile)}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {fearKeys.map(renderTile)}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            국내 공포탐욕지수는 공식 지수가 아니라 앱 자체 산출값입니다. 신용융자/예탁금 비율과 코스피 외국인 순매수를 함께 반영합니다.
          </p>
        </>
      )}
    </section>
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
  const [macroIndicators, setMacroIndicators] = useState<MacroIndicator[]>([]);
  const [macroUpdatedAt, setMacroUpdatedAt] = useState<string | null>(null);
  const [macroLoading, setMacroLoading] = useState(true);
  const [macroError, setMacroError] = useState("");

  const fetchMacroIndicators = async () => {
    const cached = readClientCache<MacroResponse>(MACRO_CACHE_KEY);

    if (cached) {
      setMacroIndicators(cached.indicators || []);
      setMacroUpdatedAt(cached.updatedAt || null);
      setMacroLoading(false);
    } else {
      setMacroLoading(true);
    }

    setMacroError("");
    try {
      const response = await fetch("/api/macro-indicators");
      const data = (await response.json()) as MacroResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "거시 지표 조회 실패");
      }

      const next = {
        indicators: data.indicators || [],
        updatedAt: data.updatedAt || null,
      };
      writeClientCache(MACRO_CACHE_KEY, next, MACRO_CACHE_TTL_MS);
      setMacroIndicators(next.indicators);
      setMacroUpdatedAt(next.updatedAt);
    } catch (err) {
      if (!cached) {
        setMacroError(
          err instanceof Error ? err.message : "거시 지표 조회 중 오류 발생"
        );
      }
    } finally {
      setMacroLoading(false);
    }
  };

  const fetchRanked = async (
    sort: SortKey,
    filter: RankFilter,
    country: Country,
    page: number
  ) => {
    const cacheKey = rankedCacheKey(sort, filter, country, page);
    const cached = readClientCache<RankedPage>(cacheKey);

    if (cached) {
      setRanked(cached);
      setRankLoading(false);
    } else {
      setRankLoading(true);
    }

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
      const nextRanked = {
        items: data.results || [],
        total: Number(data.total || 0),
        totalPages: Number(data.totalPages || 1),
      };
      writeClientCache(cacheKey, nextRanked, RANKED_CACHE_TTL_MS);
      setRanked(nextRanked);
    } catch (err) {
      if (!cached) {
        setRankError(err instanceof Error ? err.message : "집계 기업 조회 중 오류 발생");
      }
    } finally {
      setRankLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMacroIndicators();
    });
  }, []);

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
      if (result === "added") clearWatchlistRelatedCache();
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
    if (added > 0) clearWatchlistRelatedCache();
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

      <MacroIndicatorPanel
        indicators={macroIndicators}
        loading={macroLoading}
        error={macroError}
        updatedAt={macroUpdatedAt}
      />

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
