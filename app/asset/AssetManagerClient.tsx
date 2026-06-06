"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AssetSnapshot } from "@/lib/assets";

type AssetFormState = {
  yearMonth: string;
  crypto: string;
  koreaStock: string;
  usStock: string;
  realEstate: string;
  cash: string;
};

type AssetKey = "crypto" | "koreaStock" | "usStock" | "realEstate" | "cash";

const categories: Array<{
  key: AssetKey;
  label: string;
  shortLabel: string;
  color: string;
  softClass: string;
}> = [
  {
    key: "crypto",
    label: "코인",
    shortLabel: "코인",
    color: "#f97316",
    softClass: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-200",
  },
  {
    key: "koreaStock",
    label: "한국주식",
    shortLabel: "한국",
    color: "#2563eb",
    softClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  },
  {
    key: "usStock",
    label: "미국주식",
    shortLabel: "미국",
    color: "#16a34a",
    softClass: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200",
  },
  {
    key: "realEstate",
    label: "부동산",
    shortLabel: "부동산",
    color: "#7c3aed",
    softClass: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  },
  {
    key: "cash",
    label: "현금",
    shortLabel: "현금",
    color: "#0f766e",
    softClass: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200",
  },
];

const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function emptyForm(yearMonth = currentYearMonth()): AssetFormState {
  return {
    yearMonth,
    crypto: "",
    koreaStock: "",
    usStock: "",
    realEstate: "",
    cash: "",
  };
}

function snapshotToForm(snapshot: AssetSnapshot): AssetFormState {
  return {
    yearMonth: snapshot.yearMonth,
    crypto: String(snapshot.crypto),
    koreaStock: String(snapshot.koreaStock),
    usStock: String(snapshot.usStock),
    realEstate: String(snapshot.realEstate),
    cash: String(snapshot.cash),
  };
}

function parseAmount(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function formatCurrency(value: number) {
  return formatter.format(value);
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  return `${year}.${month}`;
}

function PieChart({ snapshot }: { snapshot: AssetSnapshot | null }) {
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const total = snapshot?.total || 0;
  const values = categories.map((category) => ({
    ...category,
    value: snapshot ? snapshot[category.key] : 0,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            현재월 자산 비율
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {snapshot ? `${formatMonth(snapshot.yearMonth)} 기준` : "입력된 월이 없습니다"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            총자산
          </p>
          <p className="text-xl font-black text-slate-950 dark:text-white">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:items-center">
        <div className="relative mx-auto h-56 w-56">
          <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="34"
            />
            {total > 0 &&
              values.map((item) => {
                const dash = (item.value / total) * circumference;
                const strokeDasharray = `${dash} ${circumference - dash}`;
                const strokeDashoffset = -offset;
                offset += dash;

                return (
                  <circle
                    key={item.key}
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="34"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              TOTAL
            </span>
            <span className="mt-1 text-lg font-black text-slate-950 dark:text-white">
              {numberFormatter.format(total)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {values.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.label}
                </span>
                <span className="ml-auto text-sm font-black text-slate-700 dark:text-slate-200">
                  {formatPercent(item.value, total)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedBarChart({ snapshots }: { snapshots: AssetSnapshot[] }) {
  const recentSnapshots = snapshots.slice(-12);
  const maxTotal = Math.max(1, ...recentSnapshots.map((snapshot) => snapshot.total));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            월별 자산 구성 변화
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            최근 12개월 누적 세로막대
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.key}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.label}
            </span>
          ))}
        </div>
      </div>

      {recentSnapshots.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          월별 자산을 입력하면 그래프가 표시됩니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex h-80 min-w-[720px] items-end gap-4 border-b border-slate-200 pb-9 dark:border-slate-800">
            {recentSnapshots.map((snapshot) => {
              const height = Math.max(14, (snapshot.total / maxTotal) * 230);

              return (
                <div
                  key={snapshot.yearMonth}
                  className="relative flex flex-1 flex-col items-center"
                >
                  <div
                    className="flex w-full max-w-16 flex-col-reverse overflow-hidden rounded-t-md bg-slate-100 dark:bg-slate-800"
                    style={{ height }}
                    title={`${formatMonth(snapshot.yearMonth)} ${formatCurrency(snapshot.total)}`}
                  >
                    {categories.map((category) => {
                      const value = snapshot[category.key];
                      const segmentHeight =
                        snapshot.total > 0
                          ? Math.max(value > 0 ? 2 : 0, (value / snapshot.total) * height)
                          : 0;

                      return (
                        <div
                          key={category.key}
                          style={{
                            height: segmentHeight,
                            backgroundColor: category.color,
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="absolute -bottom-7 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {formatMonth(snapshot.yearMonth)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssetManagerClient({
  initialSnapshots,
}: {
  initialSnapshots: AssetSnapshot[];
}) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [form, setForm] = useState<AssetFormState>(() => {
    const current = initialSnapshots.find(
      (snapshot) => snapshot.yearMonth === currentYearMonth()
    );
    return current ? snapshotToForm(current) : emptyForm();
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.yearMonth === form.yearMonth) || null,
    [form.yearMonth, snapshots]
  );
  const currentSnapshot = snapshots.at(-1) || null;
  const formTotal = categories.reduce((sum, category) => {
    return sum + (parseAmount(form[category.key]) ?? 0);
  }, 0);

  const updateField = (key: keyof AssetFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const selectMonth = (yearMonth: string) => {
    const snapshot = snapshots.find((item) => item.yearMonth === yearMonth);
    setForm(snapshot ? snapshotToForm(snapshot) : emptyForm(yearMonth));
    setMessage("");
    setError("");
  };

  const saveSnapshot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const values = Object.fromEntries(
      categories.map((category) => [category.key, parseAmount(form[category.key])])
    );

    if (Object.values(values).some((value) => value === null)) {
      setError("금액은 0 이상의 숫자로 입력해주세요.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: form.yearMonth,
          ...values,
        }),
      });

      const data = (await response.json()) as {
        snapshots?: AssetSnapshot[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "자산 저장에 실패했습니다.");
      }

      setSnapshots(data.snapshots || []);
      setMessage(`${formatMonth(form.yearMonth)} 자산을 저장했습니다.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "자산 저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSnapshot = async () => {
    if (!selectedSnapshot) return;

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/asset?yearMonth=${encodeURIComponent(selectedSnapshot.yearMonth)}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as {
        snapshots?: AssetSnapshot[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "자산 삭제에 실패했습니다.");
      }

      setSnapshots(data.snapshots || []);
      setForm(emptyForm(form.yearMonth));
      setMessage(`${formatMonth(selectedSnapshot.yearMonth)} 자산을 삭제했습니다.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "자산 삭제에 실패했습니다."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-300">
            Asset Management
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            월별 자산관리
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            매월 1일 기준 총자산을 입력해 자산 비율과 변화를 관리합니다.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-right dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            최근 기록 총자산
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
            {formatCurrency(currentSnapshot?.total || 0)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={saveSnapshot}
          className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                월별 입력
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                월별 한 번 저장하면 같은 월은 수정됩니다.
              </p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              KRW
            </span>
          </div>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              기준 월
            </span>
            <input
              type="month"
              required
              value={form.yearMonth}
              onChange={(event) => selectMonth(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <div className="space-y-3">
            {categories.map((category) => (
              <label key={category.key} className="block">
                <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.label}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${category.softClass}`}>
                    {formatPercent(parseAmount(form[category.key]) ?? 0, formTotal)}
                  </span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form[category.key]}
                  onChange={(event) => updateField(category.key, event.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                입력 합계
              </span>
              <span className="text-lg font-black text-slate-950 dark:text-white">
                {formatCurrency(formTotal)}
              </span>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "저장 중" : "저장"}
            </button>
            <button
              type="button"
              disabled={!selectedSnapshot || deleting}
              onClick={deleteSnapshot}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              삭제
            </button>
          </div>
        </form>

        <PieChart snapshot={currentSnapshot} />
      </div>

      <div className="mt-6">
        <StackedBarChart snapshots={snapshots} />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            입력 내역
          </h2>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {snapshots.length}개월
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-3 pr-3">월</th>
                {categories.map((category) => (
                  <th key={category.key} className="px-3 py-3 text-right">
                    {category.label}
                  </th>
                ))}
                <th className="py-3 pl-3 text-right">총자산</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    아직 입력된 자산 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                snapshots
                  .slice()
                  .reverse()
                  .map((snapshot) => (
                    <tr
                      key={snapshot.yearMonth}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-3 pr-3 font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => selectMonth(snapshot.yearMonth)}
                          className="rounded px-2 py-1 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {formatMonth(snapshot.yearMonth)}
                        </button>
                      </td>
                      {categories.map((category) => (
                        <td
                          key={category.key}
                          className="px-3 py-3 text-right text-slate-600 dark:text-slate-300"
                        >
                          {formatCurrency(snapshot[category.key])}
                        </td>
                      ))}
                      <td className="py-3 pl-3 text-right font-black text-slate-950 dark:text-white">
                        {formatCurrency(snapshot.total)}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
