"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WatchlistStock {
  id: number;
  code: string;
  name: string;
  country: string;
  market: string;
  added_at: string;
  price?: number | null;
  market_cap?: number | null;
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

export default function WatchlistPage() {
  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const [batchError, setBatchError] = useState("");
  const [reaggregating, setReaggregating] = useState(false);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/watchlist");
      if (!response.ok) throw new Error("목록 조회 실패");

      const data = await response.json();
      setStocks(data.stocks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchWatchlist();
    });
  }, []);

  const handleRemoveStock = async (id: number, name: string) => {
    if (!window.confirm(`${name}을(를) 제거하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("제거 실패");

      setStocks(stocks.filter((s) => s.id !== id));
      alert("제거되었습니다.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "제거 중 오류 발생");
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
      const summary = dispatched
        .map(
          (item: { country: string; count: number }) =>
            `${item.country} ${item.count}개`
        )
        .join(", ");
      if (dispatched.length === 0 && skippedRecentCount > 0) {
        setBatchMessage(
          `관심종목 ${skippedRecentCount}개가 모두 24시간 이내 집계되어 재집계 배치를 요청하지 않았습니다.`
        );
      } else {
        setBatchMessage(
          `재집계 배치를 요청했습니다${
            summary ? `: ${summary}` : ""
          }. 24시간 이내 집계된 ${skippedRecentCount}개는 스킵했습니다. 완료 후 새로고침하면 최신 값이 표시됩니다.`
        );
      }
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "재집계 요청 중 오류 발생");
    } finally {
      setReaggregating(false);
    }
  };

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
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            관심 종목
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            재무제표와 시가총액은 주기 배치가 DB에 저장한 최신 값을 표시합니다.
          </p>
        </div>
        {stocks.length > 0 && (
          <div className="flex gap-2">
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {stocks.map((stock) => {
            const hasMetrics =
              stock.market_cap !== null ||
              stock.equity !== null ||
              stock.net_income !== null ||
              stock.per !== null ||
              stock.pbr !== null ||
              stock.roe !== null;

            return (
              <div
                key={stock.id}
                className="rounded-lg border border-slate-200 p-6 transition hover:shadow-lg dark:border-slate-700"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {stock.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {stock.code} - {stock.market}
                    </p>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                    {stock.country === "KR" ? "KR" : "US"}
                  </span>
                </div>

                {hasMetrics ? (
                  <>
                    <div className="mb-3 grid grid-cols-3 gap-3 rounded bg-slate-50 p-3 dark:bg-slate-800">
                      <div className="text-center">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          PER
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatMetric(stock.per)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          PBR
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatMetric(stock.pbr)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          ROE
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatMetric(stock.roe, "%")}
                        </p>
                      </div>
                    </div>
                    <div className="mb-4 grid grid-cols-1 gap-2 rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600 dark:text-slate-400">
                          시가총액
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(stock.market_cap, stock.country)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600 dark:text-slate-400">
                          자본총계
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(stock.equity, stock.country)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600 dark:text-slate-400">
                          당기순이익
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(stock.net_income, stock.country)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mb-4 rounded bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    아직 배치로 적재된 재무제표 데이터가 없습니다.
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    href="/analysis"
                    className="flex-1 rounded bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
                  >
                    분석 보기
                  </Link>
                  <button
                    onClick={() => handleRemoveStock(stock.id, stock.name)}
                    className="rounded bg-red-100 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-200 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800"
                  >
                    삭제
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    추가: {new Date(stock.added_at).toLocaleDateString("ko-KR")}
                  </span>
                  {stock.collected_at && (
                    <span>
                      집계: {formatDateTime(stock.collected_at)}
                      {isCollectedWithin24Hours(stock.collected_at) &&
                        " (24시간 이내)"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
