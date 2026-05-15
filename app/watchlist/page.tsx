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
}

interface AnalysisData {
  code: string;
  market_cap?: number;
  per?: number;
  pbr?: number;
  roe?: number;
}

export default function WatchlistPage() {
  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysisData, setAnalysisData] = useState<Record<string, AnalysisData>>({});
  const [updatingCodes, setUpdatingCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWatchlist();
  }, []);

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

  const handleUpdateFinancials = async (stock: WatchlistStock) => {
    setUpdatingCodes(new Set([...updatingCodes, stock.code]));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: stock.code, save_to_db: true }),
      });

      if (!response.ok) throw new Error("업데이트 실패");

      const data = await response.json();
      setAnalysisData({
        ...analysisData,
        [stock.code]: data,
      });

      alert(`${stock.name} 재무제표 업데이트 완료!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "업데이트 중 오류 발생");
    } finally {
      setUpdatingCodes(new Set([...updatingCodes].filter((c) => c !== stock.code)));
    }
  };

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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">
          관심 종목
        </h1>
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">로드 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
          관심 종목
        </h1>
        {stocks.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm("모든 종목의 재무제표를 업데이트하시겠습니까?")) {
                  stocks.forEach((stock) => handleUpdateFinancials(stock));
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              🔄 일괄 업데이트
            </button>
            <Link
              href="/analysis"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
            >
              📊 분석 보기
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg mb-6">
          {error}
        </div>
      )}

      {stocks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-4">
            관심 종목이 없습니다.
          </p>
          <Link
            href="/search"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            🔍 종목 검색하기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stocks.map((stock) => {
            const data = analysisData[stock.code];
            const isUpdating = updatingCodes.has(stock.code);

            return (
              <div
                key={stock.id}
                className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {stock.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {stock.code} • {stock.market}
                    </p>
                  </div>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {stock.country === "KR" ? "🇰🇷 KR" : "🇺🇸 US"}
                  </span>
                </div>

                {/* Metrics Display */}
                {data ? (
                  <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <div className="text-center">
                      <p className="text-xs text-slate-600 dark:text-slate-400">PER</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {data.per?.toFixed(2) || "-"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-600 dark:text-slate-400">PBR</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {data.pbr?.toFixed(2) || "-"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-600 dark:text-slate-400">ROE</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {data.roe?.toFixed(2) || "-"}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded text-sm text-slate-600 dark:text-slate-400 mb-4">
                    재무제표 데이터 없음
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateFinancials(stock)}
                    disabled={isUpdating}
                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm transition disabled:opacity-50"
                  >
                    {isUpdating ? "🔄 업데이트 중..." : "🔄 재무제표 업데이트"}
                  </button>
                  <button
                    onClick={() => handleRemoveStock(stock.id, stock.name)}
                    className="px-3 py-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded font-semibold text-sm hover:bg-red-200 dark:hover:bg-red-800 transition"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-500 mt-3">
                  추가: {new Date(stock.added_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
