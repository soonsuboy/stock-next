"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

interface AnalysisData {
  code: string;
  name: string;
  roe?: number;
  pbr?: number;
  per?: number;
  country: string;
}

// Plotly를 동적으로 로드 (SSR 문제 방지)
const TernaryChart = dynamic(
  () =>
    import("plotly.js-dist-min").then((Plotly) => {
      return function Chart({
        data,
      }: {
        data: Array<{
          name: string;
          a: number[];
          b: number[];
          c: number[];
          mode: string;
          type: string;
          marker: any;
        }>;
      }) {
        const chartRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
          if (!chartRef.current || !data.length) return;

          const layout = {
            ternary: {
              sum: 100,
              aaxis: {
                title: "ROE (%)",
                min: 0.01,
                linewidth: 2,
                tickfont: { size: 12 },
              },
              baxis: {
                title: "PBR (배수)",
                min: 0.01,
                linewidth: 2,
                tickfont: { size: 12 },
              },
              caxis: {
                title: "PER (배수)",
                min: 0.01,
                linewidth: 2,
                tickfont: { size: 12 },
              },
            },
            title: "ROE-PBR-PER 삼각형 분석",
            showlegend: true,
            height: 600,
            margin: { l: 0, r: 0, t: 40, b: 0 },
          };

          Plotly.newPlot(chartRef.current, data, layout, {
            responsive: true,
          });

          return () => {
            if (chartRef.current) {
              Plotly.purge(chartRef.current);
            }
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

  useEffect(() => {
    fetchAnalysisData();
  }, []);

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
    (s) => s.roe !== null && s.pbr !== null && s.per !== null && s.roe && s.pbr && s.per
  );

  // Plotly 데이터 변환
  const chartData = validStocks.map((s) => ({
    name: `${s.code} (${s.name})`,
    a: [s.roe || 0],
    b: [s.pbr || 0],
    c: [s.per || 0],
    mode: "markers",
    type: "scatterternary" as any,
    marker: {
      size: 12,
      color: s.country === "KR" ? "rgb(255, 107, 107)" : "rgb(0, 100, 200)",
      symbol: s.country === "KR" ? "circle" : "diamond",
      line: { color: "white", width: 2 },
    },
  }));

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
                  stock.roe &&
                  stock.pbr &&
                  stock.per;

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
                  📈 삼각형 분석 (ROE-PBR-PER)
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
              </div>

              {/* Chart Note */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg text-sm">
                <p className="font-semibold mb-2">💡 지표 설명</p>
                <ul className="text-xs space-y-1">
                  <li>
                    • <strong>PER (주가수익비율):</strong> 낮을수록 좋음 (저평가
                    기업)
                  </li>
                  <li>
                    • <strong>PBR (주가순자산비율):</strong> 낮을수록 좋음
                    (자산 대비 저평가)
                  </li>
                  <li>
                    • <strong>ROE (자기자본수익률):</strong> 높을수록 좋음
                    (수익성 지표)
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
