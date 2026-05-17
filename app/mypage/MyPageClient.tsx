"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface MyPageClientProps {
  userName: string | null;
  userEmail: string | null;
  locked: boolean;
}

interface DiscussionAccessStatus {
  configured: boolean;
  hasAccess: boolean;
  grantedAt: string | null;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export default function MyPageClient({
  userName,
  userEmail,
  locked,
}: MyPageClientProps) {
  const [status, setStatus] = useState<DiscussionAccessStatus | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/me/discussion-access");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "마이페이지 정보를 불러오지 못했습니다.");
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "마이페이지 조회 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadStatus();
    });
  }, []);

  const submitCode = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/me/discussion-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "코드 확인에 실패했습니다.");
      }
      setStatus(data);
      setCode("");
      setMessage("종목 토론 조회 권한이 활성화되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "코드 확인 중 오류 발생");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
          마이페이지
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          내 계정 정보와 종목 토론 조회 권한을 관리합니다.
        </p>
      </div>

      {locked && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          종목 토론은 관리자에게 받은 종목토론조회 코드를 입력한 계정만 볼 수 있습니다.
        </div>
      )}

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          계정
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">이름</dt>
            <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
              {userName || "-"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">이메일</dt>
            <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
              {userEmail || "-"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          종목 토론 조회 권한
        </h2>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">권한 상태를 확인하는 중...</p>
        ) : (
          <>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                현재 상태:{" "}
                {status?.hasAccess
                  ? "조회 가능"
                  : status?.configured
                    ? "코드 입력 필요"
                    : "관리자 코드 미설정"}
              </p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                권한 활성화 시간: {formatDateTime(status?.grantedAt || null)}
              </p>
            </div>

            {status?.hasAccess ? (
              <Link
                href="/discussions"
                className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
              >
                종목 토론 보기
              </Link>
            ) : status?.configured ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="password"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="종목토론조회 코드"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  disabled={saving || !code.trim()}
                  onClick={submitCode}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "확인 중..." : "코드 확인"}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                아직 관리자가 종목토론조회 코드를 설정하지 않았습니다.
              </p>
            )}
          </>
        )}

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
    </div>
  );
}
