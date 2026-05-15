"use client";

import { useState } from "react";

interface Stock {
  code: string;
  name: string;
  market: string;
  country: string;
  price?: number;
  marcap?: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedStocks, setAddedStocks] = useState<Set<string>>(new Set());

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
    const stockKey = `${stock.country}:${stock.code}`;
    if (addedStocks.has(stockKey)) return;

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stock),
      });

      if (!response.ok) throw new Error("추가 실패");

      setAddedStocks(new Set([...addedStocks, stockKey]));
      alert(`${stock.name}을(를) 관심 종목에 추가했습니다.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "추가 중 오류 발생");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">
        종목 검색
      </h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        검색 결과는 배치가 DB에 적재한 기업 목록에서만 조회합니다.
      </p>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="종목명 또는 코드 입력 (예: 005930, 삼성전자, AAPL)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "검색 중..." : "검색"}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            검색 결과 ({results.length}개)
          </h2>
          {results.map((stock) => (
            <div
              key={`${stock.code}-${stock.country}`}
              className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {stock.name}
                </h3>
                <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400 mt-1">
                  <span>
                    📍 {stock.code} ({stock.market})
                  </span>
                  <span>
                    🌍 {stock.country === "KR" ? "🇰🇷 한국" : "🇺🇸 미국"}
                  </span>
                  {stock.price && (
                    <span>💰 {stock.price.toLocaleString()}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleAddStock(stock)}
                disabled={addedStocks.has(`${stock.country}:${stock.code}`)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  addedStocks.has(`${stock.country}:${stock.code}`)
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {addedStocks.has(`${stock.country}:${stock.code}`) ? "✓ 추가됨" : "⭐ 추가"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && query && results.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">
            검색 결과가 없습니다. 다시 시도해주세요.
          </p>
        </div>
      )}

      {!loading && !query && (
        <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400">
            종목명 또는 코드를 입력하여 검색하세요.
          </p>
        </div>
      )}
    </div>
  );
}
