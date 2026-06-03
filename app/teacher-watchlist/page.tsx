"use client";

import { useEffect, useMemo, useState } from "react";
import {
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

interface TeacherStock {
  id: number;
  code: string;
  country: string;
  display_name: string;
  name: string;
  market: string;
  currency?: string | null;
  gics_sector?: string | null;
  industry_name?: string | null;
  note?: string | null;
  sort_order: number;
  price_collectable: boolean;
  price?: number | null;
  previous_close?: number | null;
  change_rate?: number | null;
  market_cap?: number | null;
  shares_outstanding?: number | null;
  equity?: number | null;
  net_income?: number | null;
  roe?: number | null;
  pbr?: number | null;
  per?: number | null;
  collected_at?: string | null;
}

interface TeacherWatchlistResponse {
  stocks: TeacherStock[];
}

type SortKey =
  | "sort_order"
  | "market_cap"
  | "roe"
  | "pbr"
  | "per"
  | "price"
  | "change_rate";
type SortDirection = "asc" | "desc";

const CACHE_KEY = "teacher-watchlist:v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

const sortOptions: Array<{
  key: Exclude<SortKey, "sort_order">;
  label: string;
  defaultDirection: SortDirection;
}> = [
  { key: "market_cap", label: "시가총액", defaultDirection: "desc" },
  { key: "roe", label: "ROE", defaultDirection: "desc" },
  { key: "pbr", label: "PBR", defaultDirection: "asc" },
  { key: "per", label: "PER", defaultDirection: "asc" },
  { key: "price", label: "가격", defaultDirection: "desc" },
  { key: "change_rate", label: "등락률", defaultDirection: "desc" },
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

const sortValue = (stock: TeacherStock, key: SortKey) => {
  if (key === "sort_order") return stock.sort_order;
  const value = stock[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

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

export default function TeacherWatchlistPage() {
  const [stocks, setStocks] = useState<TeacherStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const fetchStocks = async (preferCache = true) => {
    const cached = preferCache
      ? readClientCache<TeacherWatchlistResponse>(CACHE_KEY)
      : null;

    if (cached) {
      setStocks(cached.stocks || []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const response = await fetch("/api/teacher-watchlist");
      const data = (await response.json()) as TeacherWatchlistResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "담쌤 관심종목 조회 실패");
      }

      writeClientCache(CACHE_KEY, data, CACHE_TTL_MS);
      setStocks(data.stocks || []);
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
      void fetchStocks();
    });
  }, []);

  const handleSortChange = (
    key: Exclude<SortKey, "sort_order">,
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
        return a.sort_order - b.sort_order;
      }
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const result = aValue - bValue;
      if (result === 0) return a.sort_order - b.sort_order;
      return sortDirection === "asc" ? result : -result;
    });
  }, [sortDirection, sortKey, stocks]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-8 text-4xl font-bold text-slate-900 dark:text-white">
          담쌤관심종목
        </h1>
        <div className="py-12 text-center text-slate-600 dark:text-slate-400">
          로드 중...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            담쌤관심종목
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            지정된 종목 묶음만 따로 모아 보고, 하루 한 번 전용 가격 배치가 최신 가격과 등락률을 갱신합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchStocks(false)}
          className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          새로고침
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            총 {stocks.length.toLocaleString("ko-KR")}개 종목
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
          <table className="min-w-[1580px] w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left dark:bg-slate-900">
                  기업명
                </th>
                <th className="px-3 py-3 text-left">시장</th>
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
                <th className="px-3 py-3 text-left">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedStocks.map((stock) => (
                <tr
                  key={stock.id}
                  className="transition hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-slate-950">
                    <div className="max-w-[300px]">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {stock.display_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {stock.name !== stock.display_name && `${stock.name} · `}
                        {stock.code} · {stock.country}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700 dark:text-slate-200">
                    {stock.market || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700 dark:text-slate-200">
                    {stock.gics_sector || "미분류"}
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
                    {formatDateTime(stock.collected_at)}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    <div className="max-w-[240px]">
                      {!stock.price_collectable && (
                        <span className="mb-1 inline-block rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                          가격 수집 제외
                        </span>
                      )}
                      <span className="block">
                        {stock.note ||
                          (stock.price_collectable ? "일일 가격 배치 대상" : "-")}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
