"use client";

import { useEffect, useState } from "react";
import {
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

interface ManagedUser {
  id: string;
  provider: string;
  providerAccountId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  active: boolean;
  disabledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  watchlistCount: number;
}

const ADMIN_USERS_CACHE_KEY = "admin:users:v1";
const ADMIN_USERS_CACHE_TTL_MS = 5 * 60 * 1000;

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export default function UserManagementPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshUsers = async (preferCache = true) => {
    const cached = preferCache
      ? readClientCache<ManagedUser[]>(ADMIN_USERS_CACHE_KEY)
      : null;

    if (cached) {
      setUsers(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "사용자 조회 실패");
      }
      const nextUsers = data.users || [];
      writeClientCache(ADMIN_USERS_CACHE_KEY, nextUsers, ADMIN_USERS_CACHE_TTL_MS);
      setUsers(nextUsers);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : "사용자 조회 중 오류 발생");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void refreshUsers();
    });
  }, []);

  const toggleUser = async (target: ManagedUser) => {
    setSavingId(target.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, active: !target.active }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "사용자 상태 변경 실패");
      }

      const nextUsers = data.users || [];
      setUsers(nextUsers);
      writeClientCache(ADMIN_USERS_CACHE_KEY, nextUsers, ADMIN_USERS_CACHE_TTL_MS);
      setMessage(
        `${target.email || target.name || target.id} 사용자를 ${
          target.active ? "비활성화" : "활성화"
        }했습니다.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "사용자 상태 변경 중 오류 발생"
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          사용자 관리
        </h2>
        <button
          type="button"
          disabled={loading}
          onClick={() => refreshUsers(false)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          목록 다시 읽기
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                사용자
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                제공자
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                관심종목
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                최근 로그인
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  사용자를 불러오는 중...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  등록된 사용자가 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {user.name || "이름 없음"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {user.email || user.id}
                    </div>
                    <div className="mt-1 max-w-sm truncate text-[11px] text-slate-400">
                      {user.id}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                    {user.provider}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {user.watchlistCount.toLocaleString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatDateTime(user.lastLoginAt || user.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={savingId !== null}
                      onClick={() => toggleUser(user)}
                      className={`rounded px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        user.active
                          ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950 dark:text-green-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {savingId === user.id
                        ? "저장 중..."
                        : user.active
                          ? "활성"
                          : "비활성"}
                    </button>
                    {!user.active && user.disabledAt && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatDateTime(user.disabledAt)}
                      </p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    </section>
  );
}
