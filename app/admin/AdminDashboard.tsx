"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminBatchStatus } from "@/lib/admin-data";
import SectorManagementPanel from "@/app/admin/SectorManagementPanel";
import UserManagementPanel from "@/app/admin/UserManagementPanel";
import {
  clearClientCache,
  clearClientCachePrefix,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

interface AdminDashboardProps {
  initialStatus: AdminBatchStatus | null;
}

type Market = "KR" | "US";
type Selection = "missing" | "existing" | "incomplete" | "codes";
type BatchSettings = AdminBatchStatus["settings"];
type AdminTab =
  | "settings"
  | "coverage"
  | "telegram"
  | "manual"
  | "runs"
  | "stockInfo"
  | "users";
type StatusSection = "summary" | "coverage" | "runs" | "all";

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
  { id: "stockInfo", label: "주식정보 관리" },
  { id: "users", label: "사용자관리" },
  { id: "manual", label: "수동배치" },
  { id: "runs", label: "최근 배치 설정" },
];

const ADMIN_STATUS_CACHE_PREFIX = "admin:status:v1:";
const ADMIN_STATUS_CACHE_TTL_MS = 2 * 60 * 1000;
const TELEGRAM_CHATS_CACHE_KEY = "admin:telegram:chats:v1";
const TELEGRAM_SUMMARY_DATES_CACHE_KEY = "admin:telegram:summary-dates:v1";
const TELEGRAM_DISCUSSION_CODES_CACHE_KEY = "admin:discussion-codes:v1";
const TELEGRAM_CACHE_TTL_MS = 5 * 60 * 1000;

function adminStatusCacheKey(section: StatusSection) {
  return `${ADMIN_STATUS_CACHE_PREFIX}${section}`;
}

function telegramRankingCacheKey(date: string, period: "day" | "week") {
  return `admin:telegram:ranking:v1:${period}:${date}`;
}

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
  const [indexSubmitting, setIndexSubmitting] = useState(false);
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
  const telegramTabLoadedRef = useRef(false);
  const [telegramDatesLoading, setTelegramDatesLoading] = useState(false);
  const [telegramRanking, setTelegramRanking] =
    useState<TelegramRanking | null>(null);
  const [telegramRankingLoading, setTelegramRankingLoading] = useState(false);
  const loadedStatusSectionsRef = useRef(
    new Set<StatusSection>(initialStatus ? ["summary", "coverage", "runs"] : [])
  );
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);

  const maxLimit = status?.maxManualLimit ?? 500;
  const selectedCoverage = useMemo(
    () => status?.coverage.find((item) => item.country === market),
    [market, status?.coverage]
  );

  const applyStatus = (nextStatus: AdminBatchStatus, section: StatusSection) => {
    setStatus((current) => {
      if (!current || section === "all") return nextStatus;
      return {
        ...current,
        ...nextStatus,
        coverage:
          section === "coverage" ? nextStatus.coverage : current.coverage,
        recentRuns:
          section === "runs" ? nextStatus.recentRuns : current.recentRuns,
      };
    });
    setSettings(nextStatus.settings);
    setDiscussionCodeConfigured(
      Boolean(nextStatus.discussionAccessCodeConfigured)
    );
    loadedStatusSectionsRef.current.add(section);
    if (section === "all") {
      loadedStatusSectionsRef.current.add("summary");
      loadedStatusSectionsRef.current.add("coverage");
      loadedStatusSectionsRef.current.add("runs");
    }
  };

  const refreshStatus = async (section: StatusSection = "summary") => {
    const cached = readClientCache<AdminBatchStatus>(
      adminStatusCacheKey(section)
    );

    if (cached) {
      applyStatus(cached, section);
      setStatusLoading(false);
      if (section === "coverage") setCoverageLoading(false);
      if (section === "runs") setRunsLoading(false);
    } else {
      if (section === "summary" || !status) setStatusLoading(true);
      if (section === "coverage") setCoverageLoading(true);
      if (section === "runs") setRunsLoading(true);
    }

    try {
      const response = await fetch(`/api/admin/status?section=${section}`);
      if (!response.ok) {
        throw new Error("관리자 상태를 다시 불러오지 못했습니다.");
      }
      const nextStatus = (await response.json()) as AdminBatchStatus;
      writeClientCache(
        adminStatusCacheKey(section),
        nextStatus,
        ADMIN_STATUS_CACHE_TTL_MS
      );
      applyStatus(nextStatus, section);
    } catch (err) {
      if (!cached) throw err;
      console.warn("Admin status refresh failed after cache hit", err);
    } finally {
      if (section === "summary" || !status) setStatusLoading(false);
      if (section === "coverage") setCoverageLoading(false);
      if (section === "runs") setRunsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialStatus) {
      queueMicrotask(() => {
        void refreshStatus("summary").catch((err) => {
          setError(err instanceof Error ? err.message : "관리자 상태 조회 실패");
          setStatusLoading(false);
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatus]);

  useEffect(() => {
    if (
      (activeTab === "coverage" || activeTab === "manual") &&
      !loadedStatusSectionsRef.current.has("coverage")
    ) {
      queueMicrotask(() => {
        void refreshStatus("coverage").catch((err) => {
          setError(err instanceof Error ? err.message : "적재 현황 조회 실패");
          setCoverageLoading(false);
        });
      });
    }

    if (activeTab === "runs" && !loadedStatusSectionsRef.current.has("runs")) {
      queueMicrotask(() => {
        void refreshStatus("runs").catch((err) => {
          setError(err instanceof Error ? err.message : "최근 실행 조회 실패");
          setRunsLoading(false);
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const refreshTelegramChats = async () => {
    const cached = readClientCache<TelegramChat[]>(TELEGRAM_CHATS_CACHE_KEY);

    if (cached) {
      setTelegramChats(cached);
      setTelegramLoading(false);
    } else {
      setTelegramLoading(true);
    }

    setTelegramError("");
    try {
      const response = await fetch("/api/admin/telegram/chats");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 채팅방 조회 실패");
      }
      const chats = data.chats || [];
      writeClientCache(TELEGRAM_CHATS_CACHE_KEY, chats, TELEGRAM_CACHE_TTL_MS);
      setTelegramChats(chats);
    } catch (err) {
      if (!cached) {
        setTelegramError(
          err instanceof Error ? err.message : "텔레그램 채팅방 조회 중 오류 발생"
        );
      }
    } finally {
      setTelegramLoading(false);
    }
  };

  const refreshTelegramSummaryDates = async () => {
    const cached = readClientCache<TelegramSummaryDate[]>(
      TELEGRAM_SUMMARY_DATES_CACHE_KEY
    );

    if (cached) {
      setTelegramSummaryDates(cached);
      setTelegramDatesLoading(false);
    } else {
      setTelegramDatesLoading(true);
    }

    setTelegramError("");
    try {
      const response = await fetch("/api/admin/telegram/summaries");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 요약 날짜 조회 실패");
      }
      const dates = data.dates || [];
      writeClientCache(
        TELEGRAM_SUMMARY_DATES_CACHE_KEY,
        dates,
        TELEGRAM_CACHE_TTL_MS
      );
      setTelegramSummaryDates(dates);
    } catch (err) {
      if (!cached) {
        setTelegramError(
          err instanceof Error ? err.message : "텔레그램 요약 날짜 조회 중 오류 발생"
        );
      }
    } finally {
      setTelegramDatesLoading(false);
    }
  };

  const refreshDiscussionCodes = async () => {
    const cached = readClientCache<{
      codes: DiscussionAccessCode[];
      configured: boolean;
    }>(TELEGRAM_DISCUSSION_CODES_CACHE_KEY);

    if (cached) {
      setDiscussionCodes(cached.codes || []);
      setDiscussionCodeConfigured(Boolean(cached.configured));
    }

    setDiscussionCodeError("");
    try {
      const response = await fetch("/api/admin/discussion-code");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "종목토론조회 코드 조회 실패");
      }
      setDiscussionCodes(data.codes || []);
      setDiscussionCodeConfigured(Boolean(data.configured));
      writeClientCache(
        TELEGRAM_DISCUSSION_CODES_CACHE_KEY,
        {
          codes: data.codes || [],
          configured: Boolean(data.configured),
        },
        TELEGRAM_CACHE_TTL_MS
      );
    } catch (err) {
      if (!cached) {
        setDiscussionCodeError(
          err instanceof Error ? err.message : "종목토론조회 코드 조회 중 오류 발생"
        );
      }
    }
  };

  useEffect(() => {
    if (activeTab !== "telegram" || telegramTabLoadedRef.current) return;

    telegramTabLoadedRef.current = true;
    queueMicrotask(() => {
      void refreshTelegramChats();
      void refreshTelegramSummaryDates();
      void refreshDiscussionCodes();
    });
  }, [activeTab]);

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
      writeClientCache(
        TELEGRAM_CHATS_CACHE_KEY,
        data.chats || [],
        TELEGRAM_CACHE_TTL_MS
      );
      clearClientCache(TELEGRAM_SUMMARY_DATES_CACHE_KEY);
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
      clearClientCachePrefix(ADMIN_STATUS_CACHE_PREFIX);
      clearClientCache(TELEGRAM_SUMMARY_DATES_CACHE_KEY);
      clearClientCachePrefix("admin:telegram:ranking:v1:");
      await refreshStatus("runs");
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
    const cacheKey = telegramRankingCacheKey(date, period);
    const cached = readClientCache<TelegramRanking>(cacheKey);

    if (cached) {
      setTelegramRanking(cached);
      setTelegramRankingLoading(false);
    } else {
      setTelegramRankingLoading(true);
    }

    setTelegramError("");
    try {
      const params = new URLSearchParams({ date, period });
      const response = await fetch(`/api/admin/telegram/rankings?${params}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "텔레그램 종목 랭킹 조회 실패");
      }
      writeClientCache(cacheKey, data, TELEGRAM_CACHE_TTL_MS);
      setTelegramRanking(data);
    } catch (err) {
      if (!cached) {
        setTelegramError(
          err instanceof Error ? err.message : "텔레그램 종목 랭킹 조회 중 오류 발생"
        );
      }
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

  const saveSettings = async (
    successMessage = "배치 설정을 저장했습니다. 다음 자동 배치부터 적용됩니다."
  ) => {
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
      clearClientCachePrefix(ADMIN_STATUS_CACHE_PREFIX);
      setSettingsMessage(successMessage);
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
      writeClientCache(
        TELEGRAM_DISCUSSION_CODES_CACHE_KEY,
        {
          codes: data.codes || [],
          configured: Boolean(data.configured),
        },
        TELEGRAM_CACHE_TTL_MS
      );
      clearClientCachePrefix(ADMIN_STATUS_CACHE_PREFIX);
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
      writeClientCache(
        TELEGRAM_DISCUSSION_CODES_CACHE_KEY,
        {
          codes: data.codes || [],
          configured: Boolean(data.configured),
        },
        TELEGRAM_CACHE_TTL_MS
      );
      clearClientCachePrefix(ADMIN_STATUS_CACHE_PREFIX);
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
      clearClientCachePrefix(ADMIN_STATUS_CACHE_PREFIX);
      await refreshStatus("runs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "배치 실행 중 오류 발생");
    } finally {
      setSubmitting(false);
    }
  };

  const dispatchIndexUniverseBatch = async () => {
    if (indexSubmitting) return;
    if (
      !window.confirm(
        "S&P500과 KOSPI200 구성 종목 약 700개의 미적재 재무/가격 데이터를 GitHub Actions로 수집 요청하시겠습니까? 완료까지 오래 걸릴 수 있습니다."
      )
    ) {
      return;
    }

    setIndexSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/trigger-index-universe", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "지수 구성종목 사전수집 요청 실패");
      }

      setMessage(
        "S&P500/KOSPI200 사전수집 배치를 요청했습니다. GitHub Actions에서 구성 종목을 갱신하고 미적재 재무/가격 데이터를 수집합니다."
      );
      clearClientCachePrefix(ADMIN_STATUS_CACHE_PREFIX);
      await refreshStatus("runs");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "지수 구성종목 사전수집 요청 중 오류 발생"
      );
    } finally {
      setIndexSubmitting(false);
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
        {coverageLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            적재 현황을 불러오는 중...
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {status.coverage.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 md:col-span-2">
              적재 현황 데이터가 없습니다.
            </div>
          ) : (
          status.coverage.map((item) => (
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
          ))
          )}
        </div>
        )}
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
              재무/기업 자동 배치 활성화
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              재무 실행 기준 시간(KST)
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
              실행 허용 시간(분)
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

          <div className="mt-5 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950 md:grid-cols-5">
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
                재무/기업 실행
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {status.schedulerMeta.lastScheduledRunDateKst || "-"}{" "}
                {status.schedulerMeta.lastScheduledRunStatus
                  ? `(${status.schedulerMeta.lastScheduledRunStatus})`
                  : ""}
                </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                관심종목 가격 갱신
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {status.schedulerMeta.lastWatchlistPriceRunDateKst || "-"}{" "}
                {status.schedulerMeta.lastWatchlistPriceRunStatus
                  ? `(${status.schedulerMeta.lastWatchlistPriceRunStatus})`
                  : ""}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                전체 가격 갱신
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {status.schedulerMeta.lastMetricPriceRunDateKst || "-"}{" "}
                {status.schedulerMeta.lastMetricPriceRunStatus
                  ? `(${status.schedulerMeta.lastMetricPriceRunStatus})`
                  : ""}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              재무제표 수집 배치
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              재무제표와 기업 마스터는 상대적으로 무거운 작업이라 요일, shard, 1회
              처리 건수를 나눠 운영합니다.
            </p>
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

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
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
          </div>

          <div className="mt-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              가격/등락률 수집 배치
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              종목검색의 상한가/하한가 필터는 전체 집계기업 가격 배치의 전일가격과
              등락률을 사용합니다.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={settings.metricPriceEnabled}
                onChange={(event) =>
                  updateSetting("metricPriceEnabled", event.target.checked)
                }
                className="h-4 w-4"
              />
              전체 집계기업 가격/등락률 매일 갱신
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              전체 가격 갱신 시간(KST)
              <input
                type="time"
                value={settings.metricPriceTimeKst}
                onChange={(event) =>
                  updateSetting("metricPriceTimeKst", event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              전체 가격 갱신 대상
              <select
                value={settings.metricPriceMarket}
                onChange={(event) =>
                  updateSetting(
                    "metricPriceMarket",
                    event.target.value as BatchSettings["metricPriceMarket"]
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="ALL">한국+미국</option>
                <option value="KR">한국만</option>
                <option value="US">미국만</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              전체 가격 1회 처리 건수
              <input
                type="number"
                min={0}
                max={10000}
                value={settings.metricPriceLimit}
                onChange={(event) =>
                  updateSetting(
                    "metricPriceLimit",
                    Number(event.target.value) || 0
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                0은 전체 실행입니다.
              </span>
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
              가격 갱신 시간(KST)
              <input
                type="time"
                value={settings.watchlistPriceTimeKst}
                onChange={(event) =>
                  updateSetting("watchlistPriceTimeKst", event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
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
              onClick={() => saveSettings()}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {settingsSaving ? "저장 중..." : "배치 설정 저장"}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              GitHub Actions는 15분마다 깨어나며, 설정 시간부터 실행 허용 시간 안에
              도착한 첫 실행만 자동 배치를 시작합니다. 허용 시간을 지나면 그날 자동
              배치는 건너뛰고 다음 날 다시 확인합니다.
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

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={settingsSaving}
              onClick={() =>
                saveSettings(
                  "텔레그램 설정을 저장했습니다. 다음 자동 실행부터 적용됩니다."
                )
              }
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {settingsSaving ? "저장 중..." : "텔레그램 설정 저장"}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              수집 여부, 조회 범위, 이미지 저장, AI 요약 설정을 바꾼 뒤 저장하세요.
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

      {activeTab === "stockInfo" && <SectorManagementPanel />}

      {activeTab === "users" && <UserManagementPanel />}

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
              {coverageLoading ? (
                <p className="mt-2">적재 현황을 불러오는 중...</p>
              ) : (
                <>
                  <p className="mt-2">
                    미적재 {formatNumber(selectedCoverage?.missingMetricsCount || 0)}
                    건, 재무 적재{" "}
                    {formatNumber(selectedCoverage?.metricsCompanyCount || 0)}건
                  </p>
                  <p className="mt-1">
                    재무 공백{" "}
                    {formatNumber(selectedCoverage?.incompleteMetricsCount || 0)}건
                  </p>
                </>
              )}
              <p className="mt-1">최대 {formatNumber(maxLimit)}건까지 요청 가능</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={indexSubmitting || !status.workflowDispatchConfigured}
              onClick={dispatchIndexUniverseBatch}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {indexSubmitting ? "요청 중..." : "S&P500+KOSPI200 사전수집"}
            </button>
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
                void refreshStatus("coverage").catch((err) =>
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
              {runsLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    최근 배치 실행 내역을 불러오는 중...
                  </td>
                </tr>
              ) : status.recentRuns.length === 0 ? (
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
