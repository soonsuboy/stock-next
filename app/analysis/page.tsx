"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

interface AnalysisData {
  code: string;
  name: string;
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

type TernaryTrace = {
  name: string;
  a: number[];
  b: number[];
  c: number[];
  text: string[];
  hovertemplate: string;
  mode: "markers";
  type: "scatterternary";
  marker: {
    size: number;
    color: string;
    symbol: string;
    line: { color: string; width: number };
  };
};

// Plotly를 동적으로 로드 (SSR 문제 방지)
const TernaryChart = dynamic(
  () =>
    import("plotly.js-dist-min").then((Plotly) => {
      return function Chart({
        data,
      }: {
        data: TernaryTrace[];
      }) {
        const chartRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
          const chartNode = chartRef.current;
          if (!chartNode || !data.length) return;

          const layout = {
            ternary: {
              sum: 100,
              aaxis: {
                title: "시가총액",
                min: 0,
                linewidth: 2,
                tickfont: { size: 12 },
              },
              baxis: {
                title: "자본총계",
                min: 0,
                linewidth: 2,
                tickfont: { size: 12 },
              },
              caxis: {
                title: "당기순이익",
                min: 0,
                linewidth: 2,
                tickfont: { size: 12 },
              },
            },
            annotations: [
              {
                text: "<b>시가총액</b>",
                x: 0.5,
                y: 1.08,
                xref: "paper",
                yref: "paper",
                showarrow: false,
                font: { size: 15 },
              },
              {
                text: "<b>자본총계</b>",
                x: 0.04,
                y: -0.04,
                xref: "paper",
                yref: "paper",
                showarrow: false,
                font: { size: 15 },
              },
              {
                text: "<b>당기순이익</b>",
                x: 0.96,
                y: -0.04,
                xref: "paper",
                yref: "paper",
                showarrow: false,
                font: { size: 15 },
              },
              {
                text: "PBR",
                x: 0.18,
                y: 0.5,
                xref: "paper",
                yref: "paper",
                showarrow: false,
                font: { size: 13, color: "#16a34a" },
              },
              {
                text: "ROE",
                x: 0.5,
                y: 0.02,
                xref: "paper",
                yref: "paper",
                showarrow: false,
                font: { size: 13, color: "#9333ea" },
              },
              {
                text: "PER",
                x: 0.82,
                y: 0.5,
                xref: "paper",
                yref: "paper",
                showarrow: false,
                font: { size: 13, color: "#2563eb" },
              },
            ],
            title: "시가총액-자본총계-당기순이익 삼각형 분석",
            showlegend: true,
            height: 600,
            margin: { l: 24, r: 24, t: 80, b: 48 },
          };

          Plotly.newPlot(chartNode, data, layout, {
            responsive: true,
          });

          return () => {
            Plotly.purge(chartNode);
          };
        }, [data]);

        return <div ref={chartRef} style={{ width: "100%", height: "600px" }} />;
      };
    }),
  { ssr: false }
);

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

  // Plotly 데이터 변환
  const chartData: TernaryTrace[] = validStocks.map((s) => {
    const marketCap = Math.max(s.market_cap || 0, 0);
    const equity = Math.max(s.equity || 0, 0);
    const netIncome = Math.max(s.net_income || 0, 0);
    const total = marketCap + equity + netIncome;

    return {
      name: `${s.code} (${s.name})`,
      a: total ? [(marketCap / total) * 100] : [0],
      b: total ? [(equity / total) * 100] : [0],
      c: total ? [(netIncome / total) * 100] : [0],
      text: [
        [
          `${s.code} ${s.name}`,
          `시가총액: ${formatCurrency(s.market_cap, s.country)}`,
          `자본총계: ${formatCurrency(s.equity, s.country)}`,
          `당기순이익: ${formatCurrency(s.net_income, s.country)}`,
          `PBR: ${s.pbr?.toFixed(2)}`,
          `ROE: ${s.roe?.toFixed(2)}%`,
          `PER: ${s.per?.toFixed(2)}`,
        ].join("<br />"),
      ],
      hovertemplate: "%{text}<extra></extra>",
      mode: "markers" as const,
      type: "scatterternary" as const,
      marker: {
        size: 12,
        color: s.country === "KR" ? "rgb(255, 107, 107)" : "rgb(0, 100, 200)",
        symbol: s.country === "KR" ? "circle" : "diamond",
        line: { color: "white", width: 2 },
      },
    };
  });

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
              {/* Ternary (Triangle) Chart */}
              <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  📈 삼각형 분석 (시가총액-자본총계-당기순이익)
                </h3>
                {chartData.length > 0 ? (
                  <TernaryChart data={chartData} />
                ) : (
                  <div className="h-80 flex items-center justify-center text-slate-500">
                    선택된 종목의 데이터가 없습니다.
                  </div>
                )}
              </div>

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
                    • <strong>점 위치:</strong> 세 원천 금액의 상대 비중을
                    합계 100으로 정규화해 표시합니다.
                  </li>
                  <li className="mt-2">
                    🇰🇷 <strong>빨간색 원:</strong> 한국 종목
                  </li>
                  <li>
                    🇺🇸 <strong>파란색 마름모:</strong> 미국 종목
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
