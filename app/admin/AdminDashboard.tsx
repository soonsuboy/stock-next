"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminBatchStatus } from "@/lib/admin-data";

interface AdminDashboardProps {
  initialStatus: AdminBatchStatus | null;
}

type Market = "KR" | "US";
type Selection = "missing" | "existing" | "incomplete" | "codes";
type BatchSettings = AdminBatchStatus["settings"];
type AdminTab = "settings" | "coverage" | "telegram" | "manual" | "runs";

interface TelegramChat {
  chatId: string;
  title: string;
  username: string | null;
  chatType: string | null;
  enabled: boolean;
  lastMessageId: number;
  updatedAt: string | null;
}

interface TelegramSummaryDate {
  date: string;
  chatCount: number;
  messageCount: number;
  summaryCount: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  lastMessageAt: string | null;
  lastSummaryAt: string | null;
}

interface TelegramRankingStock {
  key: string;
  code: string | null;
  country: string | null;
  name: string;
  count: number;
  reasons: string[];
}

interface TelegramRanking {
  date: string;
  period: "day" | "week";
  startDate: string;
  endDate: string;
  summaryRows: number;
  positive: TelegramRankingStock[];
  negative: TelegramRankingStock[];
}

interface DiscussionAccessCode {
  id: number;
  label: string;
  durationDays: number;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  activeGrantCount: number;
}

const statusLabels: Record<string, string> = {
  requested: "요청됨",
  success: "성공",
  partial: "부분 성공",
  failed: "실패",
  running: "실행 중",
};
const dayOptions = [
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" },
  { value: 6, label: "토요일" },
  { value: 7, label: "일요일" },
];
const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "settings", label: "배치설정" },
  { id: "coverage", label: "배치적재현황" },
  { id: "telegram", label: "텔레그램종목 토론설정" },
  { id: "manual", label: "수동배치" },
  { id: "runs", label: "최근 배치 설정" },
];

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

function rankingStockLabel(stock: TelegramRankingStock) {
  const code = stock.country && stock.code ? ` (${stock.country}:${stock.code})` : "";
  return `${stock.name}${code}`;
}

function summaryDateStatus(item: TelegramSummaryDate) {
  if (item.failedCount > 0) return "실패";
  if (item.pendingCount > 0) return "대기";
  if (item.successCount > 0) return "성공";
  return "미요약";
}

export default function AdminDashboard({ initialStatus }: AdminDashboardProps) {
  const [status, setStatus] = useState<AdminBatchStatus | null>(initialStatus);
  const [activeTab, setActiveTab] = useState<AdminTab>("settings");
  const [market, setMarket] = useState<Market>("KR");
  const [limit, setLimit] = useState(10);
  const [selection, setSelection] = useState<Selection>("missing");
  const [manualCodes, setManualCodes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<BatchSettings | null>(
    initialStatus?.settings ?? null
  );
  const [statusLoading, setStatusLoading] = useState(!initialStatus);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [discussionCodes, setDiscussionCodes] = useState<DiscussionAccessCode[]>([]);
  const [discussionCodeLabel, setDiscussionCodeLabel] = useState("");
  const [discussionCodeValue, setDiscussionCodeValue] = useState("");
  const [discussionCodeDurationDays, setDiscussionCodeDurationDays] = useState(30);
  const [discussionCodeConfigured, setDiscussionCodeConfigured] = useState(
    Boolean(initialStatus?.discussionAccessCodeConfigured)
  );
  const [discussionCodeSaving, setDiscussionCodeSaving] = useState(false);
  const [discussionCodeMessage, setDiscussionCodeMessage] = useState("");
  const [discussionCodeError, setDiscussionCodeError] = useState("");
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([]);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
  const [telegramError, setTelegramError] = useState("");
  const [telegramSummaryDates, setTelegramSummaryDates] = useState<
    TelegramSummaryDate[]
  >([]);
  const [telegramDatesLoading, setTelegramDatesLoading] = useState(false);
  const [telegramRanking, setTelegramRanking] =
    useState<TelegramRanking | null>(null);
  const [telegramRankingLoading, setTelegramRankingLoading] = useState(false);

  const maxLimit = status?.maxManualLimit ?? 500;
  const selectedCoverage = useMemo(
    () => status?.coverage.find((item) => item.country === market),
    [market, status?.coverage]
  );

  const refreshStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch("/api/admin/status");
      if (!response.ok) {
        throw new Error("관리자 상태를 다시 불러오지 못했습니다.");
      }
      const nextStatus = await response.json();
      setStatus(nextStatus);
      setSettings(nextStatus.settings);
      setDiscussionCodeConfigured(
        Boolean(nextStatus.discussionAccessCodeConfigured)
      );
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!initialStatus) {
      queueMicrotask(() => {
        void refreshStatus().catch((err) => {
          setError(err instanceof Error ? err.message : "관리자 상태 조회 실패");
          setStatusLoading(false);
        });
      });
    }
  }, [initialStatus]);

  const refreshTelegramChats = async () => {
    setTelegramLoading(true);
    setTelegramError("");
    try {
      const response = await fetch("/api/admin/telegram/chats");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 채팅방 조회 실패");
      }
      setTelegramChats(data.chats || []);
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : "텔레그램 채팅방 조회 중 오류 발생"
      );
    } finally {
      setTelegramLoading(false);
    }
  };

  const refreshTelegramSummaryDates = async () => {
    setTelegramDatesLoading(true);
    setTelegramError("");
    try {
      const response = await fetch("/api/admin/telegram/summaries");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 요약 날짜 조회 실패");
      }
      setTelegramSummaryDates(data.dates || []);
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : "텔레그램 요약 날짜 조회 중 오류 발생"
      );
    } finally {
      setTelegramDatesLoading(false);
    }
  };

  const refreshDiscussionCodes = async () => {
    setDiscussionCodeError("");
    try {
      const response = await fetch("/api/admin/discussion-code");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "종목토론조회 코드 조회 실패");
      }
      setDiscussionCodes(data.codes || []);
      setDiscussionCodeConfigured(Boolean(data.configured));
    } catch (err) {
      setDiscussionCodeError(
        err instanceof Error ? err.message : "종목토론조회 코드 조회 중 오류 발생"
      );
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void refreshTelegramChats();
      void refreshTelegramSummaryDates();
      void refreshDiscussionCodes();
    });
  }, []);

  const toggleTelegramChat = (chatId: string) => {
    setTelegramChats((current) =>
      current.map((chat) =>
        chat.chatId === chatId ? { ...chat, enabled: !chat.enabled } : chat
      )
    );
  };

  const saveTelegramChats = async () => {
    setTelegramSaving(true);
    setTelegramMessage("");
    setTelegramError("");
    try {
      const response = await fetch("/api/admin/telegram/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledChatIds: telegramChats
            .filter((chat) => chat.enabled)
            .map((chat) => chat.chatId),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 채팅방 저장 실패");
      }
      setTelegramChats(data.chats || []);
      setTelegramMessage("텔레그램 채팅방 설정을 저장했습니다.");
      await refreshTelegramSummaryDates();
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : "텔레그램 채팅방 저장 중 오류 발생"
      );
    } finally {
      setTelegramSaving(false);
    }
  };

  const triggerTelegram = async (
    mode: "telegram_dialogs" | "telegram_collect" | "telegram_summarize",
    backfill = false,
    date = ""
  ) => {
    setTelegramSaving(true);
    setTelegramMessage("");
    setTelegramError("");
    try {
      const response = await fetch("/api/admin/telegram/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, backfill, date }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 배치 요청 실패");
      }
      setTelegramMessage(
        backfill
          ? "텔레그램 이미지 백필 수집을 요청했습니다. GitHub Actions 완료 후 새로고침하세요."
          : date
            ? `${date} 요약 재시도를 요청했습니다. GitHub Actions 완료 후 날짜 목록을 새로고침하세요.`
          : "텔레그램 배치를 요청했습니다. GitHub Actions 완료 후 새로고침하세요."
      );
      await refreshStatus();
      await refreshTelegramSummaryDates();
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : "텔레그램 배치 요청 중 오류 발생"
      );
    } finally {
      setTelegramSaving(false);
    }
  };

  const loadTelegramRanking = async (
    date: string,
    period: "day" | "week"
  ) => {
    setTelegramRankingLoading(true);
    setTelegramError("");
    try {
      const params = new URLSearchParams({ date, period });
      const response = await fetch(`/api/admin/telegram/rankings?${params}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 종목 랭킹 조회 실패");
      }
      setTelegramRanking(data);
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : "텔레그램 종목 랭킹 조회 중 오류 발생"
      );
    } finally {
      setTelegramRankingLoading(false);
    }
  };

  const updateSetting = <K extends keyof BatchSettings>(
    key: K,
    value: BatchSettings[K]
  ) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    setSettingsMessage("");
    setSettingsError("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "배치 설정 저장 실패");
      }

      setSettings(data.settings);
      setStatus((current) =>
        current ? { ...current, settings: data.settings } : current
      );
      setSettingsMessage("배치 설정을 저장했습니다. 다음 자동 배치부터 적용됩니다.");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "배치 설정 저장 중 오류 발생");
    } finally {
      setSettingsSaving(false);
    }
  };

  const saveDiscussionCode = async () => {
    setDiscussionCodeSaving(true);
    setDiscussionCodeMessage("");
    setDiscussionCodeError("");

    try {
      const response = await fetch("/api/admin/discussion-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: discussionCodeLabel,
          code: discussionCodeValue,
          durationDays: discussionCodeDurationDays,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "종목토론조회 코드 저장 실패");
      }

      setDiscussionCodeConfigured(Boolean(data.configured));
      setDiscussionCodes(data.codes || []);
      setStatus((current) =>
        current
          ? {
              ...current,
              discussionAccessCodeConfigured: Boolean(data.configured),
            }
          : current
      );
      setDiscussionCodeLabel("");
      setDiscussionCodeValue("");
      setDiscussionCodeDurationDays(30);
      setDiscussionCodeMessage("종목토론조회 코드를 추가했습니다.");
    } catch (err) {
      setDiscussionCodeError(
        err instanceof Error ? err.message : "종목토론조회 코드 저장 중 오류 발생"
      );
    } finally {
      setDiscussionCodeSaving(false);
    }
  };

  const toggleDiscussionCode = async (id: number, active: boolean) => {
    setDiscussionCodeSaving(true);
    setDiscussionCodeMessage("");
    setDiscussionCodeError("");

    try {
      const response = await fetch("/api/admin/discussion-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "종목토론조회 코드 상태 변경 실패");
      }

      setDiscussionCodeConfigured(Boolean(data.configured));
      setDiscussionCodes(data.codes || []);
      setStatus((current) =>
        current
          ? {
              ...current,
              discussionAccessCodeConfigured: Boolean(data.configured),
            }
          : current
      );
      setDiscussionCodeMessage(
        active ? "종목토론조회 코드를 활성화했습니다." : "종목토론조회 코드를 비활성화했습니다."
      );
    } catch (err) {
      setDiscussionCodeError(
        err instanceof Error ? err.message : "종목토론조회 코드 상태 변경 중 오류 발생"
      );
    } finally {
      setDiscussionCodeSaving(false);
    }
  };

  const dispatchBatch = async (nextSelection: Selection) => {
    if (!status) return;
    setSubmitting(true);
    setMessage("");
    setError("");
    setSelection(nextSelection);

    try {
      const response = await fetch("/api/admin/trigger-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          limit,
          selection: nextSelection === "codes" ? "all" : nextSelection,
          codes: nextSelection === "codes" ? manualCodes : "",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "배치 실행 요청 실패");
      }

      setMessage(
        nextSelection === "codes"
          ? `${coverageLabel(market)} 특정 종목(${manualCodes}) 재집계 배치를 요청했습니다.`
          : `${coverageLabel(market)} ${formatNumber(limit)}건 ${
              nextSelection === "missing"
                ? "신규 수집"
                : nextSelection === "incomplete"
                  ? "재무 공백 재집계"
                  : "재집계"
            } 배치를 요청했습니다. 최근 배치 실행에 요청 기록이 먼저 남고, GitHub Actions가 시작하면 실행 기록으로 갱신됩니다.`
      );
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "배치 실행 중 오류 발생");
    } finally {
      setSubmitting(false);
    }
  };

  if (!status || !settings) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
          관리자
        </h1>
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {statusLoading ? "관리자 현황을 불러오는 중..." : error || "관리자 현황을 불러오지 못했습니다."}
        </div>
      </div>
    );
  }

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
          수동 배치를 실행하려면 Vercel 또는 localhost 환경변수에{" "}
          <span className="font-mono font-semibold">GITHUB_ACTIONS_TOKEN</span>
          을 추가해야 합니다. 현재 페이지는 현황 조회만 가능합니다.
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {adminTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "telegram" && (
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          종목토론 접근 설정
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              코드명
              <input
                type="text"
                value={discussionCodeLabel}
                onChange={(event) => setDiscussionCodeLabel(event.target.value)}
                placeholder="예: 1개월 체험"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              종목토론조회 코드
              <input
                type="password"
                value={discussionCodeValue}
                onChange={(event) => setDiscussionCodeValue(event.target.value)}
                placeholder="사용자에게 공유할 코드"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              조회 기간(일)
              <input
                type="number"
                min={1}
                max={3650}
                value={discussionCodeDurationDays}
                onChange={(event) =>
                  setDiscussionCodeDurationDays(
                    Math.max(1, Math.min(3650, Number(event.target.value) || 1))
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={discussionCodeSaving || !discussionCodeValue.trim()}
                onClick={saveDiscussionCode}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
              >
                {discussionCodeSaving ? "저장 중..." : "코드 추가"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            현재 상태: {discussionCodeConfigured ? "활성 코드 있음" : "활성 코드 없음"}.
            사용자가 마이페이지에서 코드를 입력하면 해당 코드의 기간만큼 종목 토론을 볼 수 있습니다.
          </p>

          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                    코드명
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    기간
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    활성 사용자
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                    생성
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {discussionCodes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      아직 등록된 코드가 없습니다.
                    </td>
                  </tr>
                ) : (
                  discussionCodes.map((code) => (
                    <tr key={code.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {code.label}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {formatNumber(code.durationDays)}일
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {formatNumber(code.activeGrantCount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDateTime(code.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={discussionCodeSaving}
                          onClick={() => toggleDiscussionCode(code.id, !code.active)}
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            code.active
                              ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950 dark:text-green-200"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {code.active ? "활성" : "비활성"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {discussionCodeMessage && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              {discussionCodeMessage}
            </div>
          )}
          {discussionCodeError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {discussionCodeError}
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === "coverage" && (
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
                    재무 공백 기업
                  </dt>
                  <dd className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(item.incompleteMetricsCount)}
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
      )}

      {activeTab === "settings" && (
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          자동 배치 설정
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={settings.scheduleEnabled}
                onChange={(event) =>
                  updateSetting("scheduleEnabled", event.target.checked)
                }
                className="h-4 w-4"
              />
              자동 배치 활성화
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              실행 기준 시간(KST)
              <input
                type="time"
                value={settings.scheduleTimeKst}
                onChange={(event) =>
                  updateSetting("scheduleTimeKst", event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              지연 경고 기준(분)
              <input
                type="number"
                min={5}
                max={1440}
                value={settings.scheduleWindowMinutes}
                onChange={(event) =>
                  updateSetting(
                    "scheduleWindowMinutes",
                    Number(event.target.value) || 1440
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950 md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                마지막 스케줄 체크
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {formatDateTime(status.schedulerMeta.lastSchedulerCheckAt)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                체크 결과
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {status.schedulerMeta.lastSchedulerCheckReason || "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                마지막 자동 실행
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {status.schedulerMeta.lastScheduledRunDateKst || "-"}{" "}
                {status.schedulerMeta.lastScheduledRunStatus
                  ? `(${status.schedulerMeta.lastScheduledRunStatus})`
                  : ""}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.companyMasterEnabled}
                  onChange={(event) =>
                    updateSetting("companyMasterEnabled", event.target.checked)
                  }
                  className="h-4 w-4"
                />
                기업 마스터 갱신
              </label>
              <label className="mt-3 block text-sm text-slate-600 dark:text-slate-400">
                실행 요일
                <select
                  value={settings.companyMasterDay}
                  onChange={(event) =>
                    updateSetting("companyMasterDay", Number(event.target.value))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {dayOptions.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.krEnabled}
                  onChange={(event) =>
                    updateSetting("krEnabled", event.target.checked)
                  }
                  className="h-4 w-4"
                />
                한국 재무 갱신
              </label>
              <label className="mt-3 block text-sm text-slate-600 dark:text-slate-400">
                실행 요일
                <select
                  value={settings.krDay}
                  onChange={(event) =>
                    updateSetting("krDay", Number(event.target.value))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {dayOptions.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm text-slate-600 dark:text-slate-400">
                1회 처리 건수
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={settings.krLimit}
                  onChange={(event) =>
                    updateSetting("krLimit", Number(event.target.value) || 0)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">0은 전체 실행입니다.</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.usEnabled}
                  onChange={(event) =>
                    updateSetting("usEnabled", event.target.checked)
                  }
                  className="h-4 w-4"
                />
                미국 재무 갱신
              </label>
              <label className="mt-3 block text-sm text-slate-600 dark:text-slate-400">
                1회 처리 건수
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={settings.usLimit}
                  onChange={(event) =>
                    updateSetting("usLimit", Number(event.target.value) || 0)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <label className="mt-3 block text-sm text-slate-600 dark:text-slate-400">
                미국 shard 수
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={settings.usShardCount}
                  onChange={(event) =>
                    updateSetting("usShardCount", Number(event.target.value) || 7)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">0건은 shard 전체 실행입니다.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              자동 배치 대상
              <select
                value={settings.scheduledSelection}
                onChange={(event) =>
                  updateSetting(
                    "scheduledSelection",
                    event.target.value as BatchSettings["scheduledSelection"]
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="all">전체 재집계</option>
                <option value="missing">미적재 기업만</option>
                <option value="existing">기존 적재 기업만</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={settings.watchlistPriceEnabled}
                onChange={(event) =>
                  updateSetting("watchlistPriceEnabled", event.target.checked)
                }
                className="h-4 w-4"
              />
              관심종목 가격/시총 매일 갱신
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              관심종목 재집계 스킵 기준(시간)
              <input
                type="number"
                min={0}
                max={168}
                value={settings.watchlistSkipRecentHours}
                onChange={(event) =>
                  updateSetting(
                    "watchlistSkipRecentHours",
                    Number(event.target.value) || 0
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={settingsSaving}
              onClick={saveSettings}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {settingsSaving ? "저장 중..." : "배치 설정 저장"}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              GitHub Actions는 15분마다 깨어나며, GitHub가 늦게 실행해도
              설정 시간 이후 그날 첫 실행이면 배치를 시작합니다. 기준보다 늦으면
              스케줄러 로그에 late로 남깁니다.
            </p>
          </div>

          {settingsMessage && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              {settingsMessage}
            </div>
          )}
          {settingsError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {settingsError}
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === "telegram" && (
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          텔레그램 종목 토론 설정
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={settings.telegramEnabled}
                onChange={(event) =>
                  updateSetting("telegramEnabled", event.target.checked)
                }
                className="h-4 w-4"
              />
              매시간 텔레그램 수집
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              최근 대화 조회 범위(시간)
              <input
                type="number"
                min={1}
                max={168}
                value={settings.telegramCollectHoursBack}
                onChange={(event) =>
                  updateSetting(
                    "telegramCollectHoursBack",
                    Number(event.target.value) || 2
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              방별 최대 메시지 수
              <input
                type="number"
                min={10}
                max={1000}
                value={settings.telegramMessageLimit}
                onChange={(event) =>
                  updateSetting(
                    "telegramMessageLimit",
                    Number(event.target.value) || 200
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={settings.telegramMediaEnabled}
                onChange={(event) =>
                  updateSetting("telegramMediaEnabled", event.target.checked)
                }
                className="h-4 w-4"
              />
              이미지 저장
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              이미지 최대 크기(bytes)
              <input
                type="number"
                min={0}
                max={3000000}
                value={settings.telegramMediaMaxBytes}
                onChange={(event) =>
                  updateSetting(
                    "telegramMediaMaxBytes",
                    Number(event.target.value) || 0
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={settings.telegramSummaryEnabled}
                onChange={(event) =>
                  updateSetting("telegramSummaryEnabled", event.target.checked)
                }
                className="h-4 w-4"
              />
              AI 날짜별 요약
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={telegramSaving}
              onClick={() => triggerTelegram("telegram_dialogs")}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              채팅방 목록 새로고침
            </button>
            <button
              type="button"
              disabled={telegramSaving}
              onClick={() => triggerTelegram("telegram_collect")}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950"
            >
              대화 수동 수집
            </button>
            <button
              type="button"
              disabled={telegramSaving}
              onClick={() => triggerTelegram("telegram_collect", true)}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              이미지 백필 수집
            </button>
            <button
              type="button"
              disabled={telegramSaving}
              onClick={() => triggerTelegram("telegram_summarize")}
              className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              오늘 대화 AI 요약
            </button>
            <button
              type="button"
              disabled={telegramLoading}
              onClick={refreshTelegramChats}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              목록 다시 읽기
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
              사용할 채팅방 선택
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {telegramChats.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  아직 저장된 채팅방 목록이 없습니다. `채팅방 목록 새로고침` 배치를 먼저 실행하세요.
                </div>
              ) : (
                telegramChats.map((chat) => (
                  <label
                    key={chat.chatId}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {chat.title}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {chat.chatType || "chat"} · {chat.username || chat.chatId}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={chat.enabled}
                      onChange={() => toggleTelegramChat(chat.chatId)}
                      className="h-4 w-4"
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={telegramSaving}
              onClick={saveTelegramChats}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              채팅방 선택 저장
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              GitHub Secrets에 TELEGRAM_API_ID, TELEGRAM_API_HASH,
              TELEGRAM_SESSION_STRING, OPENAI_API_KEY가 필요합니다.
              평소에는 최근 대화 조회 범위를 2시간으로 두고, 과거 누락분만
              백필할 때 범위를 늘리는 것을 권장합니다.
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  수집 날짜별 요약 관리
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  OpenAI 결제나 키 문제로 실패한 날짜는 요약 재시도로 다시 분석할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                disabled={telegramDatesLoading}
                onClick={refreshTelegramSummaryDates}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                날짜 새로고침
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                      날짜
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                      대화
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                      성공/실패/대기
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                      최근 수집
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                      기능
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {telegramDatesLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        수집 날짜를 불러오는 중...
                      </td>
                    </tr>
                  ) : telegramSummaryDates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        아직 수집된 날짜가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    telegramSummaryDates.map((item) => (
                      <tr key={item.date}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                          <span className="font-semibold">{item.date}</span>
                          <span className="ml-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {summaryDateStatus(item)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                          {formatNumber(item.messageCount)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                          {formatNumber(item.successCount)} /{" "}
                          {formatNumber(item.failedCount)} /{" "}
                          {formatNumber(item.pendingCount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {formatDateTime(item.lastMessageAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={telegramSaving}
                              onClick={() =>
                                triggerTelegram("telegram_summarize", false, item.date)
                              }
                              className="rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                            >
                              요약 재시도
                            </button>
                            <button
                              type="button"
                              disabled={telegramRankingLoading}
                              onClick={() => loadTelegramRanking(item.date, "day")}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              당일 랭킹
                            </button>
                            <button
                              type="button"
                              disabled={telegramRankingLoading}
                              onClick={() => loadTelegramRanking(item.date, "week")}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              1주 랭킹
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {telegramRanking && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {telegramRanking.period === "week" ? "1주" : "당일"} 긍정/부정
                  언급 랭킹
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  기준: {telegramRanking.startDate} ~ {telegramRanking.endDate} ·
                  성공 요약 {formatNumber(telegramRanking.summaryRows)}건
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-bold text-green-700 dark:text-green-300">
                    긍정 종목
                  </h4>
                  <ol className="mt-2 space-y-2 text-sm">
                    {telegramRanking.positive.length === 0 ? (
                      <li className="text-slate-500">집계된 종목이 없습니다.</li>
                    ) : (
                      telegramRanking.positive.map((stock) => (
                        <li key={stock.key}>
                          <span className="font-semibold">
                            {rankingStockLabel(stock)}
                          </span>
                          <span className="ml-2 text-slate-500">
                            {formatNumber(stock.count)}회
                          </span>
                          {stock.reasons[0] && (
                            <p className="mt-1 text-xs text-slate-500">
                              {stock.reasons[0]}
                            </p>
                          )}
                        </li>
                      ))
                    )}
                  </ol>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-red-700 dark:text-red-300">
                    부정 종목
                  </h4>
                  <ol className="mt-2 space-y-2 text-sm">
                    {telegramRanking.negative.length === 0 ? (
                      <li className="text-slate-500">집계된 종목이 없습니다.</li>
                    ) : (
                      telegramRanking.negative.map((stock) => (
                        <li key={stock.key}>
                          <span className="font-semibold">
                            {rankingStockLabel(stock)}
                          </span>
                          <span className="ml-2 text-slate-500">
                            {formatNumber(stock.count)}회
                          </span>
                          {stock.reasons[0] && (
                            <p className="mt-1 text-xs text-slate-500">
                              {stock.reasons[0]}
                            </p>
                          )}
                        </li>
                      ))
                    )}
                  </ol>
                </div>
              </div>
            </div>
          )}

          {telegramMessage && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              {telegramMessage}
            </div>
          )}
          {telegramError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {telegramError}
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === "manual" && (
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              특정 종목 코드
              <input
                type="text"
                value={manualCodes}
                onChange={(event) => setManualCodes(event.target.value)}
                placeholder={market === "US" ? "예: BSAC,AAPL" : "예: 005930"}
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
              <p className="mt-1">
                재무 공백 {formatNumber(selectedCoverage?.incompleteMetricsCount || 0)}
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
              disabled={submitting || !status.workflowDispatchConfigured}
              onClick={() => dispatchBatch("incomplete")}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && selection === "incomplete"
                ? "요청 중..."
                : "재무 공백 재집계"}
            </button>
            <button
              type="button"
              disabled={
                submitting ||
                !status.workflowDispatchConfigured ||
                !manualCodes.trim()
              }
              onClick={() => dispatchBatch("codes")}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && selection === "codes" ? "요청 중..." : "특정 종목 재집계"}
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
      )}

      {activeTab === "runs" && (
      <section>
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          최근 배치 실행
        </h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          최근 100개 요청/실행을 표시합니다.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  시작
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  완료
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  작업
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
                    colSpan={9}
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
                      {formatDateTime(run.completedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                      {run.jobName}
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
      )}
    </div>
  );
}
