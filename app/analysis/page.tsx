"use client";

import { useEffect, useState } from "react";

interface AnalysisData {
  code: string;
  name: string;
  market?: string | null;
  gics_sector?: string | null;
  industry_name?: string | null;
  profile?: {
    overview: string;
    productsServices: string[];
    profileSource: "curated" | "sector_fallback";
  };
  roe?: number;
  pbr?: number;
  per?: number;
  market_cap?: number;
  equity?: number;
  net_income?: number;
  country: string;
}

const formatCurrency = (value: number | null | undefined, country: string) => {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: country === "KR" ? "KRW" : "USD",
    notation: "compact",
    maximumFractionDigits: country === "KR" ? 0 : 2,
  }).format(value);
};

function CompanyProfilePanel({ stocks }: { stocks: AnalysisData[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
        기업 개요와 주요 제품/서비스
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {stocks.map((stock) => {
          const products = stock.profile?.productsServices || [];

          return (
            <article
              key={`${stock.country}:${stock.code}`}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {stock.name}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {stock.code} · {stock.market || stock.country}
                    {stock.gics_sector ? ` · ${stock.gics_sector}` : ""}
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {stock.profile?.profileSource === "curated"
                    ? "기업별 프로필"
                    : "섹터 기반 요약"}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {stock.profile?.overview ||
                  `${stock.name}의 기업 개요 정보가 아직 준비되지 않았습니다.`}
              </p>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  주요 제품/서비스
                </p>
                <div className="flex flex-wrap gap-2">
                  {products.length > 0 ? (
                    products.map((product) => (
                      <span
                        key={product}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
                      >
                        {product}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">
                      등록된 제품/서비스 정보가 없습니다.
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TriangleDiagram({ stock }: { stock: AnalysisData }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
            {stock.name}
          </h4>
          <p className="text-xs text-slate-500">
            {stock.code} {stock.country === "KR" ? "KR" : "US"}
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {stock.country === "KR" ? "한국" : "미국"}
        </span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <svg
          viewBox="0 0 720 620"
          className="h-auto min-h-[760px] w-[170%] max-w-none sm:w-full"
          role="img"
          aria-label={`${stock.name} 시가총액, 자본총계, 당기순이익, PBR, ROE, PER 삼각형 다이어그램`}
        >
        <polygon
          points="360,98 132,520 588,520"
          fill="#eef4f9"
          stroke="#2d3f52"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        <foreignObject x="270" y="8" width="180" height="82">
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-amber-700 bg-amber-50 px-2 text-center text-slate-900">
            <div className="text-sm font-semibold leading-tight">시가총액</div>
            <div className="text-base font-bold leading-tight">
              {formatCurrency(stock.market_cap, stock.country)}
            </div>
          </div>
        </foreignObject>

        <foreignObject x="16" y="516" width="144" height="82">
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-green-700 bg-green-50 px-2 text-center text-slate-900">
            <div className="text-sm font-semibold leading-tight">자본총계</div>
            <div className="text-base font-bold leading-tight">
              {formatCurrency(stock.equity, stock.country)}
            </div>
          </div>
        </foreignObject>

        <foreignObject x="560" y="516" width="144" height="82">
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-red-700 bg-red-50 px-2 text-center text-slate-900">
            <div className="text-sm font-semibold leading-tight">당기순이익</div>
            <div className="text-base font-bold leading-tight">
              {formatCurrency(stock.net_income, stock.country)}
            </div>
          </div>
        </foreignObject>

        <text
          x="168"
          y="330"
          textAnchor="middle"
          className="fill-blue-700 text-base font-semibold"
        >
          <tspan x="168" dy="0">PBR</tspan>
          <tspan x="168" dy="22">{stock.pbr?.toFixed(2)}</tspan>
        </text>

        <text
          x="360"
          y="568"
          textAnchor="middle"
          className="fill-orange-700 text-base font-semibold"
        >
          <tspan x="360" dy="0">ROE</tspan>
          <tspan x="360" dy="22">{stock.roe?.toFixed(2)}%</tspan>
        </text>

        <text
          x="552"
          y="330"
          textAnchor="middle"
          className="fill-purple-700 text-base font-semibold"
        >
          <tspan x="552" dy="0">PER</tspan>
          <tspan x="552" dy="22">{stock.per?.toFixed(2)}</tspan>
        </text>
        </svg>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const [stocks, setStocks] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/watchlist/analysis");
      if (!response.ok) throw new Error("분석 데이터 조회 실패");

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
      void fetchAnalysisData();
    });
  }, []);

  const toggleStockSelection = (code: string) => {
    const newSelected = new Set(selectedCodes);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedCodes(newSelected);
  };

  const selectedStocks = stocks.filter((s) => selectedCodes.has(s.code));

  // 데이터 검증 및 정규화
  const validStocks = selectedStocks.filter(
    (s) =>
      s.roe !== null &&
      s.pbr !== null &&
      s.per !== null &&
      s.market_cap !== null &&
      s.equity !== null &&
      s.net_income !== null &&
      s.roe &&
      s.pbr &&
      s.per &&
      s.market_cap &&
      s.equity &&
      s.net_income
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">
          분석 대시보드
        </h1>
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">로드 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">
        분석 대시보드
      </h1>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Stock List */}
        <div className="md:col-span-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            종목 선택
          </h2>

          {stocks.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-400">
              관심 종목이 없거나 분석 데이터가 없습니다.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {stocks.map((stock) => {
                const isSelected = selectedCodes.has(stock.code);
                const hasData =
                  stock.roe !== null &&
                  stock.pbr !== null &&
                  stock.per !== null &&
                  stock.market_cap !== null &&
                  stock.equity !== null &&
                  stock.net_income !== null &&
                  stock.roe &&
                  stock.pbr &&
                  stock.per &&
                  stock.market_cap &&
                  stock.equity &&
                  stock.net_income;

                return (
                  <label
                    key={stock.code}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    } ${!hasData ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStockSelection(stock.code)}
                      disabled={!hasData}
                      className="w-4 h-4 mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">
                        {stock.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {stock.code} {stock.country === "KR" ? "🇰🇷" : "🇺🇸"}
                      </p>
                    </div>
                    {!hasData && (
                      <span className="text-xs text-slate-500">데이터 없음</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Visualization & Metrics */}
        <div className="md:col-span-2">
          {validStocks.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                분석할 종목을 선택하세요.
              </p>
              <p className="text-sm text-slate-500">
                좌측 목록에서 종목을 선택하면 지표가 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Triangle Diagrams */}
              <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  📈 삼각형 다이어그램
                </h3>
                <div className="grid grid-cols-1 gap-6">
                  {validStocks.map((stock) => (
                    <TriangleDiagram key={stock.code} stock={stock} />
                  ))}
                </div>
              </div>

              <CompanyProfilePanel stocks={validStocks} />

              {/* Metrics Summary */}
              <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  📊 지표 현황
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {/* PER */}
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">
                      PER (주가수익비율)
                    </p>
                    <div className="space-y-1">
                      {validStocks.map((s) => (
                        <div
                          key={s.code}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-slate-900 dark:text-white">
                            {s.code}
                          </span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {s.per?.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PBR */}
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">
                      PBR (주가순자산비율)
                    </p>
                    <div className="space-y-1">
                      {validStocks.map((s) => (
                        <div
                          key={s.code}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-slate-900 dark:text-white">
                            {s.code}
                          </span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {s.pbr?.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ROE */}
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">
                      ROE (자기자본수익률)
                    </p>
                    <div className="space-y-1">
                      {validStocks.map((s) => (
                        <div
                          key={s.code}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-slate-900 dark:text-white">
                            {s.code}
                          </span>
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {s.roe?.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-3">
                    업데이트 시점 원천 금액
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 dark:text-slate-400">
                          <th className="py-2 pr-3 font-semibold">종목</th>
                          <th className="py-2 pr-3 font-semibold">시가총액</th>
                          <th className="py-2 pr-3 font-semibold">자본총액</th>
                          <th className="py-2 font-semibold">당기순이익</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validStocks.map((s) => (
                          <tr
                            key={s.code}
                            className="border-t border-slate-200 dark:border-slate-700"
                          >
                            <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">
                              {s.code}
                            </td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                              {formatCurrency(s.market_cap, s.country)}
                            </td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                              {formatCurrency(s.equity, s.country)}
                            </td>
                            <td className="py-2 text-slate-700 dark:text-slate-300">
                              {formatCurrency(s.net_income, s.country)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Chart Note */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg text-sm">
                <p className="font-semibold mb-2">💡 지표 설명</p>
                <ul className="text-xs space-y-1">
                  <li>
                    • <strong>꼭지점:</strong> 상단은 시가총액, 왼쪽은
                    자본총계, 오른쪽은 당기순이익입니다.
                  </li>
                  <li>
                    • <strong>변 라벨:</strong> 왼쪽 변은 PBR, 아랫변은 ROE,
                    오른쪽 변은 PER입니다.
                  </li>
                  <li>
                    • <strong>수치:</strong> 각 꼭지점에는 원천 금액을, 각 변에는
                    해당 투자지표 값을 표시합니다.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
