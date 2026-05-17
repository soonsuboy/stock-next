"use client";

import { useEffect, useMemo, useState } from "react";

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
    dataUrl: string;
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

export default function DiscussionsPage() {
  const [data, setData] = useState<DiscussionData | null>(null);
  const [chatId, setChatId] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");
  const [triggering, setTriggering] = useState(false);

  const loadData = async (nextChatId = chatId, nextDate = date) => {
    setLoading(true);
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
      setData(payload);
      setChatId(payload.selectedChatId || "");
      setDate(payload.selectedDate || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "종목 토론 조회 중 오류 발생");
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
          종목 토론
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          관리자가 선택한 텔레그램 채팅방의 시간대별 대화와 날짜별 AI 요약을 조회합니다.
        </p>
      </div>

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
          onClick={() => void loadData(chatId, date)}
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
                          <span className="font-semibold">{stockLabel(stock)}</span>
                          {stock.reason && (
                            <span className="text-slate-500"> · {stock.reason}</span>
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
                          <span className="font-semibold">{stockLabel(stock)}</span>
                          {stock.reason && (
                            <span className="text-slate-500"> · {stock.reason}</span>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </section>
            ))}

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
                          {message.senderName && <span>{message.senderName}</span>}
                        </div>
                        {message.text && (
                          <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                            {message.text}
                          </p>
                        )}
                        {message.media?.dataUrl &&
                          message.media.mimeType.startsWith("image/") && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={message.media.dataUrl}
                            alt={message.media.fileName || "telegram media"}
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
    </div>
  );
}
