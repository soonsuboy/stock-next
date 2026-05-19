"use client";

import { useEffect, useMemo, useState } from "react";
import { readClientCache, writeClientCache } from "@/lib/client-cache";

interface Chat {
  chatId: string;
  title: string;
}

interface DiscussionDate {
  date: string;
  messageCount: number;
  summary: string;
}

interface DiscussionMessage {
  chatId: string;
  messageId: number;
  messageDate: string;
  hourKey: string;
  senderName: string;
  text: string;
  hasMedia: boolean;
  media: null | {
    mimeType: string;
    fileName: string;
    sizeBytes: number;
    mediaUrl: string;
  };
}

interface SummaryStock {
  code?: string;
  country?: string;
  name?: string;
  reason?: string;
}

interface DiscussionSummary {
  chatId: string;
  title: string;
  summary: string;
  positiveStocks: SummaryStock[];
  negativeStocks: SummaryStock[];
  status: string;
  error: string;
  updatedAt: string | null;
}

interface DiscussionData {
  chats: Chat[];
  dates: DiscussionDate[];
  selectedChatId: string;
  selectedDate: string;
  messages: DiscussionMessage[];
  summaries: DiscussionSummary[];
}

interface StudySummaryResult {
  sourceUrl: string;
  fetchedAt: string;
  model: string;
  postCount: number;
  summarizedBodyCount: number;
  summary: {
    summary: string;
    corePoints: string[];
    studyTopics: string[];
    actionItems: string[];
  };
}

interface DiscussionsClientProps {
  canTriggerMetrics: boolean;
}

type DiscussionTab = "telegram" | "study";
const DISCUSSION_CACHE_TTL_MS = 2 * 60 * 1000;
const STUDY_SUMMARY_CACHE_KEY = "discussions:study-summary:v1";

function discussionCacheKey(chatId: string, date: string) {
  return `discussions:telegram:v1:${chatId || "all"}:${date || "latest"}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stockLabel(stock: SummaryStock) {
  const code = stock.code && stock.country ? ` (${stock.country}:${stock.code})` : "";
  return `${stock.name || stock.code || "종목"}${code}`;
}

export default function DiscussionsClient({
  canTriggerMetrics,
}: DiscussionsClientProps) {
  const [activeTab, setActiveTab] = useState<DiscussionTab>("telegram");
  const [data, setData] = useState<DiscussionData | null>(null);
  const [chatId, setChatId] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [studySummary, setStudySummary] = useState<StudySummaryResult | null>(
    null
  );
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState("");

  const loadData = async (
    nextChatId = chatId,
    nextDate = date,
    preferCache = true
  ) => {
    const cacheKey = discussionCacheKey(nextChatId, nextDate);
    const cached = preferCache
      ? readClientCache<DiscussionData>(cacheKey)
      : null;

    if (cached) {
      setData(cached);
      setChatId(cached.selectedChatId || "");
      setDate(cached.selectedDate || "");
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");
    const params = new URLSearchParams();
    if (nextChatId) params.set("chatId", nextChatId);
    if (nextDate) params.set("date", nextDate);

    try {
      const response = await fetch(`/api/discussions?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "종목 토론 조회 실패");
      }
      writeClientCache(cacheKey, payload, DISCUSSION_CACHE_TTL_MS);
      setData(payload);
      setChatId(payload.selectedChatId || "");
      setDate(payload.selectedDate || "");
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : "종목 토론 조회 중 오류 발생");
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load only; later loads are driven by the chat/date controls.
  useEffect(() => {
    queueMicrotask(() => {
      void loadData("", "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedMessages = useMemo(() => {
    const groups = new Map<string, DiscussionMessage[]>();
    for (const message of data?.messages || []) {
      const items = groups.get(message.hourKey) || [];
      items.push(message);
      groups.set(message.hourKey, items);
    }
    return Array.from(groups.entries());
  }, [data?.messages]);

  const summarizeStudyFeed = async () => {
    if (studyLoading) return;
    const cached = readClientCache<StudySummaryResult>(STUDY_SUMMARY_CACHE_KEY);
    if (cached) {
      setStudySummary(cached);
    }

    setStudyLoading(true);
    setStudyError("");
    try {
      const response = await fetch("/api/discussions/study-summary", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "스터디 피드 정리 실패");
      }
      writeClientCache(STUDY_SUMMARY_CACHE_KEY, payload, 30 * 60 * 1000);
      setStudySummary(payload);
    } catch (err) {
      setStudyError(
        err instanceof Error ? err.message : "스터디 피드 정리 중 오류 발생"
      );
    } finally {
      setStudyLoading(false);
    }
  };

  const triggerMetrics = async (sentiment: "positive" | "negative" | "all") => {
    if (!date || triggering) return;
    setTriggering(true);
    setTriggerMessage("");
    try {
      const response = await fetch("/api/discussions/trigger-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, chatId, sentiment }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "재무제표 집계 요청 실패");
      }
      const summary = (payload.dispatched || [])
        .map((item: { country: string; count: number }) => `${item.country} ${item.count}개`)
        .join(", ");
      setTriggerMessage(summary ? `재무제표 집계를 요청했습니다: ${summary}` : "집계할 종목이 없습니다.");
    } catch (err) {
      setTriggerMessage(err instanceof Error ? err.message : "재무제표 집계 요청 중 오류 발생");
    } finally {
      setTriggering(false);
    }
  };

  const tabButtonClass = (tab: DiscussionTab) =>
    [
      "rounded-md px-4 py-2 text-sm font-semibold transition",
      activeTab === tab
        ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    ].join(" ");

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
          종목 토론
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          텔레그램 토론과 스터디 피드를 한 곳에서 조회하고 AI로 정리합니다.
        </p>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          aria-pressed={activeTab === "telegram"}
          className={tabButtonClass("telegram")}
          onClick={() => setActiveTab("telegram")}
        >
          텔레그램
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "study"}
          className={tabButtonClass("study")}
          onClick={() => setActiveTab("study")}
        >
          스터디
        </button>
      </div>

      {activeTab === "telegram" ? (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            <select
              value={chatId}
              onChange={(event) => {
                setChatId(event.target.value);
                void loadData(event.target.value, date);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">전체 채팅방</option>
              {(data?.chats || []).map((chat) => (
                <option key={chat.chatId} value={chat.chatId}>
                  {chat.title}
                </option>
              ))}
            </select>
            <select
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                void loadData(chatId, event.target.value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {(data?.dates || []).map((item) => (
                <option key={item.date} value={item.date}>
                  {item.date} · {item.messageCount}건
                  {item.summary ? ` · ${item.summary.slice(0, 40)}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadData(chatId, date, false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              새로고침
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              종목 토론을 불러오는 중...
            </div>
          ) : !data || data.chats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">
              활성화된 텔레그램 채팅방이 없습니다. 관리자 페이지에서 채팅방 목록을 새로고침하고 사용할 방을 선택하세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
              <aside className="space-y-4">
                {(data.summaries || []).map((summary) => (
                  <section
                    key={`${summary.chatId}-${summary.updatedAt}`}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {summary.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {summary.summary || "요약이 아직 없습니다."}
                    </p>
                    {summary.status === "failed" && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-300">
                        {summary.error}
                      </p>
                    )}

                    <div className="mt-4">
                      <h3 className="text-sm font-bold text-green-700 dark:text-green-300">
                        긍정 종목
                      </h3>
                      <ul className="mt-2 space-y-2 text-sm">
                        {summary.positiveStocks.length === 0 ? (
                          <li className="text-slate-500">-</li>
                        ) : (
                          summary.positiveStocks.map((stock, index) => (
                            <li key={`${stockLabel(stock)}-${index}`}>
                              <span className="font-semibold">
                                {stockLabel(stock)}
                              </span>
                              {stock.reason && (
                                <span className="text-slate-500">
                                  {" "}
                                  · {stock.reason}
                                </span>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-sm font-bold text-red-700 dark:text-red-300">
                        부정 종목
                      </h3>
                      <ul className="mt-2 space-y-2 text-sm">
                        {summary.negativeStocks.length === 0 ? (
                          <li className="text-slate-500">-</li>
                        ) : (
                          summary.negativeStocks.map((stock, index) => (
                            <li key={`${stockLabel(stock)}-${index}`}>
                              <span className="font-semibold">
                                {stockLabel(stock)}
                              </span>
                              {stock.reason && (
                                <span className="text-slate-500">
                                  {" "}
                                  · {stock.reason}
                                </span>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </section>
                ))}

                {canTriggerMetrics && (
                  <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      요약 종목 재무 집계
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={triggering}
                        onClick={() => triggerMetrics("positive")}
                        className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        긍정 종목 집계
                      </button>
                      <button
                        type="button"
                        disabled={triggering}
                        onClick={() => triggerMetrics("negative")}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        부정 종목 집계
                      </button>
                      <button
                        type="button"
                        disabled={triggering}
                        onClick={() => triggerMetrics("all")}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
                      >
                        전체 집계
                      </button>
                    </div>
                    {triggerMessage && (
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                        {triggerMessage}
                      </p>
                    )}
                  </section>
                )}
              </aside>

              <section className="space-y-5">
                {groupedMessages.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    선택한 날짜에 저장된 대화가 없습니다.
                  </div>
                ) : (
                  groupedMessages.map(([hour, messages]) => (
                    <div
                      key={hour}
                      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
                        {hour}
                      </h2>
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <article
                            key={`${message.chatId}-${message.messageId}`}
                            className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{formatDateTime(message.messageDate)}</span>
                              {message.senderName && (
                                <span>{message.senderName}</span>
                              )}
                            </div>
                            {message.text && (
                              <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                                {message.text}
                              </p>
                            )}
                            {message.media?.mediaUrl &&
                              message.media.mimeType.startsWith("image/") && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={message.media.mediaUrl}
                                  alt={
                                    message.media.fileName || "telegram media"
                                  }
                                  className="mt-3 max-h-96 rounded-lg border border-slate-200 object-contain dark:border-slate-800"
                                />
                              )}
                          </article>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  스터디 전체 피드
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  지인이 만든 주식 강의 사이트를 이 탭 안에서 바로 조회합니다.
                </p>
              </div>
              <a
                href="https://shinyduck21-svg.github.io/Stock-Study/#"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                새 창 열기
              </a>
            </div>
            <iframe
              title="Stock Study full feed"
              src="https://shinyduck21-svg.github.io/Stock-Study/#"
              className="h-[760px] w-full bg-white"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    AI 정리
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    전체 피드 목록과 최근 본문을 읽고 요약·핵심정리를 만듭니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void summarizeStudyFeed()}
                disabled={studyLoading}
                className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
              >
                {studyLoading ? "정리 중..." : "[정리하기]"}
              </button>

              {studyError && (
                <div className="mt-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                  {studyError}
                </div>
              )}

              {studySummary ? (
                <div className="mt-5 space-y-5">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(studySummary.fetchedAt)} · 피드{" "}
                      {studySummary.postCount}개 · 본문{" "}
                      {studySummary.summarizedBodyCount}개 ·{" "}
                      {studySummary.model}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                      {studySummary.summary.summary || "요약이 비어 있습니다."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      핵심 정리
                    </h3>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {studySummary.summary.corePoints.length === 0 ? (
                        <li>-</li>
                      ) : (
                        studySummary.summary.corePoints.map((item, index) => (
                          <li key={`${item}-${index}`}>• {item}</li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      반복 학습 주제
                    </h3>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {studySummary.summary.studyTopics.length === 0 ? (
                        <li>-</li>
                      ) : (
                        studySummary.summary.studyTopics.map((item, index) => (
                          <li key={`${item}-${index}`}>• {item}</li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      확인할 항목
                    </h3>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {studySummary.summary.actionItems.length === 0 ? (
                        <li>-</li>
                      ) : (
                        studySummary.summary.actionItems.map((item, index) => (
                          <li key={`${item}-${index}`}>• {item}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  정리 결과가 아직 없습니다. 버튼을 누르면 오른쪽 패널에 요약과 핵심 정리가 표시됩니다.
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
