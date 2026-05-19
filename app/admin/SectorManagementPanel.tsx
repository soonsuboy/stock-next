"use client";

import { useEffect, useState } from "react";
import type { SectorGuide } from "@/lib/sector-guides";
import {
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

const emptyForm = {
  originalName: "",
  name: "",
  guidePer: "",
  guidePbr: "",
  guideRoe: "",
  summary: "",
  sortOrder: 999,
  active: true,
};

type SectorForm = typeof emptyForm;
const ADMIN_SECTORS_CACHE_KEY = "admin:sectors:v1";
const ADMIN_SECTORS_CACHE_TTL_MS = 5 * 60 * 1000;

export default function SectorManagementPanel() {
  const [sectors, setSectors] = useState<SectorGuide[]>([]);
  const [form, setForm] = useState<SectorForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshSectors = async (preferCache = true) => {
    const cached = preferCache
      ? readClientCache<SectorGuide[]>(ADMIN_SECTORS_CACHE_KEY)
      : null;

    if (cached) {
      setSectors(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const response = await fetch("/api/admin/sectors");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "섹터 정보 조회 실패");
      }
      const nextSectors = data.sectors || [];
      writeClientCache(
        ADMIN_SECTORS_CACHE_KEY,
        nextSectors,
        ADMIN_SECTORS_CACHE_TTL_MS
      );
      setSectors(nextSectors);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : "섹터 정보 조회 중 오류 발생");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void refreshSectors();
    });
  }, []);

  const editSector = (sector: SectorGuide) => {
    setMessage("");
    setError("");
    setForm({
      originalName: sector.name,
      name: sector.name,
      guidePer: sector.guidePer,
      guidePbr: sector.guidePbr,
      guideRoe: sector.guideRoe,
      summary: sector.summary,
      sortOrder: sector.sortOrder,
      active: sector.active,
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setMessage("");
    setError("");
  };

  const saveSector = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/sectors", {
        method: form.originalName ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "섹터 정보 저장 실패");
      }
      const nextSectors = data.sectors || [];
      setSectors(nextSectors);
      writeClientCache(
        ADMIN_SECTORS_CACHE_KEY,
        nextSectors,
        ADMIN_SECTORS_CACHE_TTL_MS
      );
      setForm(emptyForm);
      setMessage("섹터 정보를 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "섹터 정보 저장 중 오류 발생");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
        주식정보 관리
      </h2>
      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            섹터명
            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="예: 정보기술"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            PER 가이드
            <input
              type="text"
              value={form.guidePer}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  guidePer: event.target.value,
                }))
              }
              placeholder="25~40+"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            PBR 가이드
            <input
              type="text"
              value={form.guidePbr}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  guidePbr: event.target.value,
                }))
              }
              placeholder="3~5+"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            ROE 가이드
            <input
              type="text"
              value={form.guideRoe}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  guideRoe: event.target.value,
                }))
              }
              placeholder="15%+"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            정렬
            <input
              type="number"
              min={1}
              value={form.sortOrder}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value) || 999,
                }))
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          설명
          <textarea
            value={form.summary}
            onChange={(event) =>
              setForm((current) => ({ ...current, summary: event.target.value }))
            }
            rows={3}
            placeholder="섹터별 재무지표 해석 가이드를 입력하세요."
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({ ...current, active: event.target.checked }))
              }
              className="h-4 w-4"
            />
            사용
          </label>
          <button
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={saveSector}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "저장 중..." : form.originalName ? "수정 저장" : "섹터 추가"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            새 입력
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => refreshSectors(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            목록 다시 읽기
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

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  섹터
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  지표 가이드
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  설명
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    섹터 정보를 불러오는 중...
                  </td>
                </tr>
              ) : sectors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    등록된 섹터 정보가 없습니다.
                  </td>
                </tr>
              ) : (
                sectors.map((sector) => (
                  <tr key={sector.name}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => editSector(sector)}
                        className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                      >
                        {sector.name}
                      </button>
                      <p className="mt-1 text-xs text-slate-500">
                        정렬 {sector.sortOrder}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      PER {sector.guidePer || "-"} · PBR{" "}
                      {sector.guidePbr || "-"} · ROE {sector.guideRoe || "-"}
                    </td>
                    <td className="max-w-xl px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {sector.summary || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          sector.active
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {sector.active ? "사용" : "미사용"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
