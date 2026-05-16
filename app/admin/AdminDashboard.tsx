"use client";

import { useMemo, useState } from "react";
import type { AdminBatchStatus } from "@/lib/admin-data";

interface AdminDashboardProps {
  initialStatus: AdminBatchStatus;
}

type Market = "KR" | "US";
type Selection = "missing" | "existing";

const statusLabels: Record<string, string> = {
  success: "성공",
  partial: "부분 성공",
  failed: "실패",
  running: "실행 중",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

function coverageLabel(country: string) {
  return country === "KR" ? "한국" : "미국";
}

export default function AdminDashboard({ initialStatus }: AdminDashboardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [market, setMarket] = useState<Market>("KR");
  const [limit, setLimit] = useState(10);
  const [selection, setSelection] = useState<Selection>("missing");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const maxLimit = status.maxManualLimit;
  const selectedCoverage = useMemo(
    () => status.coverage.find((item) => item.country === market),
    [market, status.coverage]
  );

  const refreshStatus = async () => {
    const response = await fetch("/api/admin/status");
    if (!response.ok) {
      throw new Error("관리자 상태를 다시 불러오지 못했습니다.");
    }
    setStatus(await response.json());
  };

  const dispatchBatch = async (nextSelection: Selection) => {
    setSubmitting(true);
    setMessage("");
    setError("");
    setSelection(nextSelection);

    try {
      const response = await fetch("/api/admin/trigger-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, limit, selection: nextSelection }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "배치 실행 요청 실패");
      }

      setMessage(
        `${coverageLabel(market)} ${formatNumber(limit)}건 ${
          nextSelection === "missing" ? "신규 수집" : "재집계"
        } 배치를 요청했습니다. GitHub Actions에서 실행 상태를 확인할 수 있습니다.`
      );
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "배치 실행 중 오류 발생");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
          관리자
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          DB 적재 현황과 GitHub Actions 배치 실행 상태를 확인합니다.
        </p>
      </div>

      {!status.workflowDispatchConfigured && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          수동 배치를 실행하려면 Vercel 환경변수에{" "}
          <span className="font-mono font-semibold">GITHUB_ACTIONS_TOKEN</span>
          을 추가해야 합니다. 현재 페이지는 현황 조회만 가능합니다.
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          적재 현황
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {status.coverage.map((item) => (
            <div
              key={item.country}
              className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {coverageLabel(item.country)}
                </h3>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {item.country}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">
                    기업 마스터
                  </dt>
                  <dd className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(item.companyCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">
                    재무 적재 기업
                  </dt>
                  <dd className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(item.metricsCompanyCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">
                    미적재 기업
                  </dt>
                  <dd className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(item.missingMetricsCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">
                    지표 이력 행
                  </dt>
                  <dd className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(item.metricsRowCount)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                최신 스냅샷: {item.latestSnapshot || "-"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          수동 배치
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              시장
              <select
                value={market}
                onChange={(event) => setMarket(event.target.value as Market)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="KR">한국</option>
                <option value="US">미국</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              가져올 기업 수
              <input
                type="number"
                min={1}
                max={maxLimit}
                value={limit}
                onChange={(event) =>
                  setLimit(Math.max(1, Math.min(maxLimit, Number(event.target.value) || 1)))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                현재 선택
              </p>
              <p className="mt-2">
                미적재 {formatNumber(selectedCoverage?.missingMetricsCount || 0)}
                건, 재무 적재 {formatNumber(selectedCoverage?.metricsCompanyCount || 0)}
                건
              </p>
              <p className="mt-1">최대 {formatNumber(maxLimit)}건까지 요청 가능</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting || !status.workflowDispatchConfigured}
              onClick={() => dispatchBatch("missing")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && selection === "missing" ? "요청 중..." : "미적재 기업 수집"}
            </button>
            <button
              type="button"
              disabled={submitting || !status.workflowDispatchConfigured}
              onClick={() => dispatchBatch("existing")}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
            >
              {submitting && selection === "existing" ? "요청 중..." : "기존 기업 재집계"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setMessage("");
                setError("");
                void refreshStatus().catch((err) =>
                  setError(err instanceof Error ? err.message : "새로고침 실패")
                );
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              새로고침
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            수동 배치는 Vercel에서 직접 수집하지 않고 GitHub Actions workflow를
            실행합니다. 새 실행은 `batch_runs`에 완료 후 기록됩니다.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          최근 배치 실행
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  시작
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  시장
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  상태
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  처리
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  성공
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  실패
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  오류 샘플
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {status.recentRuns.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    아직 기록된 배치 실행이 없습니다.
                  </td>
                </tr>
              ) : (
                status.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                      {formatDateTime(run.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                      {run.market || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {statusLabels[run.status] || run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                      {formatNumber(run.processed)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                      {formatNumber(run.succeeded)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                      {formatNumber(run.failed)}
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {run.errorSample || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
