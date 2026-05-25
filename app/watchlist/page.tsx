"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  clearClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

interface WatchlistStock {
  id: number;
  code: string;
  name: string;
  country: string;
  market: string;
  gics_sector?: string | null;
  industry_name?: string | null;
  sector_source?: string | null;
  added_at: string;
  price?: number | null;
  previous_close?: number | null;
  change_rate?: number | null;
  market_cap?: number | null;
  shares_outstanding?: number | null;
  equity?: number | null;
  net_income?: number | null;
  operating_income?: number | null;
  total_liabilities?: number | null;
  roe?: number | null;
  pbr?: number | null;
  per?: number | null;
  debt_ratio?: number | null;
  collected_at?: string | null;
}

interface SectorGuide {
  name: string;
  guidePer: string;
  guidePbr: string;
  guideRoe: string;
  summary: string;
  active: boolean;
}

interface WatchlistResponse {
  stocks: WatchlistStock[];
  sectors: SectorGuide[];
}

type WatchlistSortKey = "added_at" | "roe" | "pbr" | "per" | "price" | "market_cap";
type SortDirection = "asc" | "desc";

const WATCHLIST_CACHE_KEY = "watchlist:v1";
const ANALYSIS_CACHE_KEY = "analysis:v2";
const WATCHLIST_CACHE_TTL_MS = 5 * 60 * 1000;

const sortOptions: Array<{
  key: Exclude<WatchlistSortKey, "added_at">;
  label: string;
  defaultDirection: SortDirection;
}> = [
  { key: "roe", label: "ROE", defaultDirection: "desc" },
  { key: "pbr", label: "PBR", defaultDirection: "asc" },
  { key: "per", label: "PER", defaultDirection: "asc" },
  { key: "price", label: "주식가격", defaultDirection: "desc" },
  { key: "market_cap", label: "시가총액", defaultDirection: "desc" },
];

function clearWatchlistRelatedCache() {
  clearClientCache(WATCHLIST_CACHE_KEY);
  clearClientCache(ANALYSIS_CACHE_KEY);
}

const normalizeSectorName = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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

const formatShares = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";

  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value >= 1_000_000 ? 0 : 2,
  }).format(value)}주`;
};

const parseDateValue = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: string | null | undefined) => {
  const date = parseDateValue(value);
  if (!date) return "-";

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isCollectedWithin24Hours = (value: string | null | undefined) => {
  const date = parseDateValue(value);
  if (!date) return false;
  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
};

const sortValue = (stock: WatchlistStock, key: WatchlistSortKey) => {
  if (key === "added_at") {
    const date = parseDateValue(stock.added_at);
    return date ? date.getTime() : null;
  }

  const value = stock[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

function SectorTooltip({ guide }: { guide: SectorGuide }) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-label={`${guide.name} 지표 가이드`}
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-600 transition hover:border-blue-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
      >
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-7 z-20 w-72 -translate-x-1/2 translate-y-1 rounded-lg border border-slate-200 bg-white p-4 text-left text-xs text-slate-700 opacity-0 shadow-xl transition duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">
          {guide.name} 지표 가이드
        </span>
        <span className="mt-3 grid grid-cols-3 gap-2">
          <span className="rounded bg-slate-50 p-2 dark:bg-slate-900">
            <span className="block text-slate-500 dark:text-slate-400">PER</span>
            <span className="font-semibold">{guide.guidePer}</span>
          </span>
          <span className="rounded bg-slate-50 p-2 dark:bg-slate-900">
            <span className="block text-slate-500 dark:text-slate-400">PBR</span>
            <span className="font-semibold">{guide.guidePbr}</span>
          </span>
          <span className="rounded bg-slate-50 p-2 dark:bg-slate-900">
            <span className="block text-slate-500 dark:text-slate-400">ROE</span>
            <span className="font-semibold">{guide.guideRoe}</span>
          </span>
        </span>
        <span className="mt-3 block leading-relaxed">{guide.summary}</span>
      </span>
    </span>
  );
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

export default function WatchlistPage() {
  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [sectorGuides, setSectorGuides] = useState<SectorGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const [batchError, setBatchError] = useState("");
  const [reaggregating, setReaggregating] = useState(false);
  const [manualCollectingId, setManualCollectingId] = useState<number | null>(
    null
  );
  const [sectorSavingId, setSectorSavingId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<WatchlistSortKey>("added_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const applyWatchlistData = (data: WatchlistResponse) => {
    setStocks(data.stocks || []);
    setSectorGuides(data.sectors || []);
  };

  const fetchWatchlist = async (preferCache = true) => {
    const cached = preferCache
      ? readClientCache<WatchlistResponse>(WATCHLIST_CACHE_KEY)
      : null;

    if (cached) {
      applyWatchlistData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const response = await fetch("/api/watchlist");
      if (!response.ok) throw new Error("목록 조회 실패");

      const data = (await response.json()) as WatchlistResponse;
      writeClientCache(WATCHLIST_CACHE_KEY, data, WATCHLIST_CACHE_TTL_MS);
      applyWatchlistData(data);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : "조회 중 오류 발생");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchWatchlist();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveStock = async (id: number, name: string) => {
    if (!window.confirm(`${name}을(를) 제거하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("제거 실패");

      clearWatchlistRelatedCache();
      setStocks(stocks.filter((s) => s.id !== id));
      alert("제거되었습니다.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "제거 중 오류 발생");
    }
  };

  const handleUpdateSector = async (
    stock: WatchlistStock,
    nextSectorValue: string
  ) => {
    const nextSector = normalizeSectorName(nextSectorValue);
    const currentSector = normalizeSectorName(stock.gics_sector);
    if (
      !nextSector ||
      !sectorGuides.some((sector) => sector.name === nextSector) ||
      nextSector === currentSector ||
      sectorSavingId !== null
    ) {
      return;
    }

    setSectorSavingId(stock.id);
    setBatchMessage("");
    setBatchError("");

    try {
      const response = await fetch(`/api/watchlist/${stock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gicsSector: nextSector }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "섹터 저장 실패");
      }

      setStocks((currentStocks) =>
        currentStocks.map((item) =>
          item.id === stock.id
            ? {
                ...item,
                gics_sector: nextSector,
                sector_source: "user_manual",
              }
            : item
        )
      );
      clearWatchlistRelatedCache();
      setBatchMessage(`${stock.name} 섹터를 ${nextSector}(으)로 저장했습니다.`);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "섹터 저장 중 오류 발생");
    } finally {
      setSectorSavingId(null);
    }
  };

  const handleReaggregateWatchlist = async () => {
    if (stocks.length === 0 || reaggregating) return;
    if (
      !window.confirm(
        `관심종목 ${stocks.length}개의 재무제표 재집계 배치를 요청하시겠습니까? 데이터는 GitHub Actions 배치가 끝난 뒤 갱신됩니다.`
      )
    ) {
      return;
    }

    setReaggregating(true);
    setBatchMessage("");
    setBatchError("");

    try {
      const response = await fetch("/api/watchlist/reaggregate", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "재집계 요청 실패");
      }

      const dispatched = data.dispatched || [];
      const skippedRecentCount = Number(data.skippedRecentCount || 0);
      const skipRecentHours = Number(data.skipRecentHours || 24);
      const summary = dispatched
        .map(
          (item: { country: string; count: number }) =>
            `${item.country} ${item.count}개`
        )
        .join(", ");
      if (dispatched.length === 0 && skippedRecentCount > 0) {
        setBatchMessage(
          `관심종목 ${skippedRecentCount}개가 모두 ${skipRecentHours}시간 이내 집계되어 재집계 배치를 요청하지 않았습니다.`
        );
      } else {
        setBatchMessage(
          `재집계 배치를 요청했습니다${
            summary ? `: ${summary}` : ""
          }. ${skipRecentHours}시간 이내 집계된 ${skippedRecentCount}개는 스킵했습니다. 완료 후 새로고침하면 최신 값이 표시됩니다.`
        );
      }
      clearWatchlistRelatedCache();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "재집계 요청 중 오류 발생");
    } finally {
      setReaggregating(false);
    }
  };

  const hasMissingMetricData = (stock: WatchlistStock) =>
    stock.equity === null ||
    stock.equity === undefined ||
    stock.net_income === null ||
    stock.net_income === undefined ||
    stock.per === null ||
    stock.per === undefined ||
    stock.pbr === null ||
    stock.pbr === undefined ||
    stock.roe === null ||
    stock.roe === undefined;

  const handleManualCollectStock = async (stock: WatchlistStock) => {
    if (manualCollectingId !== null) return;
    if (
      !window.confirm(
        `${stock.name}의 재무제표와 최신 가격을 다시 수집하시겠습니까? 완료 후 새로고침하면 오늘 기준 가격/시가총액과 지표가 반영됩니다.`
      )
    ) {
      return;
    }

    setManualCollectingId(stock.id);
    setBatchMessage("");
    setBatchError("");

    try {
      const response = await fetch("/api/watchlist/reaggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: stock.id,
          code: stock.code,
          country: stock.country,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "수동 수집 요청 실패");
      }

      const dispatched = data.dispatched || [];
      const summary = dispatched
        .map(
          (item: { country: string; count: number }) =>
            `${item.country} ${item.count}개`
        )
        .join(", ");
      setBatchMessage(
        `${stock.name} 수동 수집 배치를 요청했습니다${
          summary ? `: ${summary}` : ""
        }. 재무제표와 최신 가격을 함께 가져오며, GitHub Actions 완료 후 새로고침하면 반영됩니다.`
      );
      clearWatchlistRelatedCache();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "수동 수집 요청 중 오류 발생");
    } finally {
      setManualCollectingId(null);
    }
  };

  const handleSortChange = (
    key: Exclude<WatchlistSortKey, "added_at">,
    defaultDirection: SortDirection
  ) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(defaultDirection);
  };

  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);

      if (aValue === null && bValue === null) {
        const aAdded = sortValue(a, "added_at") || 0;
        const bAdded = sortValue(b, "added_at") || 0;
        return bAdded - aAdded;
      }
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const result = aValue - bValue;
      if (result === 0) {
        const aAdded = sortValue(a, "added_at") || 0;
        const bAdded = sortValue(b, "added_at") || 0;
        return bAdded - aAdded;
      }
      return sortDirection === "asc" ? result : -result;
    });
  }, [sortDirection, sortKey, stocks]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-8 text-4xl font-bold text-slate-900 dark:text-white">
          관심 종목
        </h1>
        <div className="py-12 text-center">
          <p className="text-slate-600 dark:text-slate-400">로드 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            관심 종목
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            재무제표는 주기 배치가 저장한 값을, 가격과 시가총액은 관심종목 일일 가격 배치가 갱신한 최신 값을 표시합니다.
          </p>
        </div>
        {stocks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/search"
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
            >
              종목 추가
            </Link>
            <Link
              href="/analysis"
              className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition hover:bg-purple-700"
            >
              분석 보기
            </Link>
            <button
              type="button"
              onClick={handleReaggregateWatchlist}
              disabled={reaggregating}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
            >
              {reaggregating ? "재집계 요청 중..." : "재무제표 재집계"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {batchMessage && (
        <div className="mb-6 rounded-lg bg-green-100 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
          {batchMessage}
        </div>
      )}

      {batchError && (
        <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
          {batchError}
        </div>
      )}

      {stocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <p className="mb-4 text-lg text-slate-600 dark:text-slate-400">
            관심 종목이 없습니다.
          </p>
          <Link
            href="/search"
            className="inline-block rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700"
          >
            종목 검색하기
          </Link>
        </div>
      ) : (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              총 {stocks.length.toLocaleString("ko-KR")}개 관심종목
            </div>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    handleSortChange(option.key, option.defaultDirection)
                  }
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    sortKey === option.key
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {option.label}
                  {sortKey === option.key &&
                    (sortDirection === "asc" ? " ▲" : " ▼")}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <table className="min-w-[1680px] w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left dark:bg-slate-900">
                    기업명
                  </th>
                  <th className="px-3 py-3 text-left">섹터</th>
                  <th className="px-3 py-3 text-right">ROE</th>
                  <th className="px-3 py-3 text-right">PBR</th>
                  <th className="px-3 py-3 text-right">PER</th>
                  <th className="px-3 py-3 text-right">가격</th>
                  <th className="px-3 py-3 text-right">전일가격</th>
                  <th className="px-3 py-3 text-right">등락률</th>
                  <th className="px-3 py-3 text-right">시가총액</th>
                  <th className="px-3 py-3 text-right">주식수</th>
                  <th className="px-3 py-3 text-right">자본총계</th>
                  <th className="px-3 py-3 text-right">당기순이익</th>
                  <th className="px-3 py-3 text-left">집계시각</th>
                  <th className="px-3 py-3 text-left">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedStocks.map((stock) => {
                  const gicsSector = normalizeSectorName(stock.gics_sector);
                  const sectorGuide = sectorGuides.find(
                    (sector) => sector.name === gicsSector
                  );
                  const hasMissingMetrics = hasMissingMetricData(stock);

                  return (
                    <tr
                      key={stock.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-slate-950">
                        <div className="max-w-[300px]">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {stock.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {stock.code} · {stock.market} ·{" "}
                            {stock.country === "KR" ? "KR" : "US"}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            id={`sector-${stock.id}`}
                            value={gicsSector || ""}
                            onChange={(event) =>
                              handleUpdateSector(stock, event.target.value)
                            }
                            disabled={sectorSavingId !== null}
                            className="w-36 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-900"
                          >
                            <option value="">미분류</option>
                            {sectorGuides.map((sector) => (
                              <option key={sector.name} value={sector.name}>
                                {sector.name}
                              </option>
                            ))}
                          </select>
                          {sectorGuide && <SectorTooltip guide={sectorGuide} />}
                          {stock.sector_source === "user_manual" && (
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                              수동
                            </span>
                          )}
                          {sectorSavingId === stock.id && (
                            <span className="text-xs text-blue-600 dark:text-blue-300">
                              저장 중
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                        {formatMetric(stock.roe, "%")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                        {formatMetric(stock.pbr)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                        {formatMetric(stock.per)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(stock.price, stock.country, false)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                        {formatCurrency(stock.previous_close, stock.country, false)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <ChangeRateBadge value={stock.change_rate} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(stock.market_cap, stock.country)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                        {formatShares(stock.shares_outstanding)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                        {formatCurrency(stock.equity, stock.country)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                        {formatCurrency(stock.net_income, stock.country)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                        {stock.collected_at ? (
                          <>
                            {formatDateTime(stock.collected_at)}
                            {isCollectedWithin24Hours(stock.collected_at) && (
                              <span className="ml-1 rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-200">
                                24h
                              </span>
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Link
                            href="/analysis"
                            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
                          >
                            분석
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleManualCollectStock(stock)}
                            disabled={manualCollectingId !== null}
                            className={`rounded px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              hasMissingMetrics
                                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
                                : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                            }`}
                          >
                            {manualCollectingId === stock.id
                              ? "요청 중"
                              : hasMissingMetrics
                                ? "누락수집"
                                : "수동수집"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStock(stock.id, stock.name)}
                            className="rounded bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-200 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
