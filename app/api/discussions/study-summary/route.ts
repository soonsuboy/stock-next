import { NextResponse } from "next/server";
import { requireDiscussionAccessApi } from "@/lib/discussion-access";

export const dynamic = "force-dynamic";

const STUDY_BASE_URL = "https://shinyduck21-svg.github.io/Stock-Study/";
const STUDY_POSTS_URL = `${STUDY_BASE_URL}data/posts.json`;
const STUDY_DISPLAY_URL = `${STUDY_BASE_URL}#`;
const MAX_BODY_POSTS = 24;
const MAX_PROMPT_CHARS = 42000;

interface StudyPost {
  id?: number | string;
  title?: string;
  time?: string;
  type?: string;
  category?: string;
  likes?: number;
  isNew?: boolean;
  fileName?: string;
  url?: string;
  audioUrl?: string;
}

interface StudySummary {
  summary: string;
  corePoints: string[];
  studyTopics: string[];
  actionItems: string[];
}

function openAiApiKey() {
  return (process.env.OPENAI_API_KEY || "").trim();
}

function openAiModel() {
  return (process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
}

async function fetchText(url: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json,text/markdown,text/plain,*/*",
        "User-Agent": "soonsuboy-stock-next-study-summary/1.0",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function trimForPrompt(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...(truncated)`;
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonText(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(trimmed);
}

function responseText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const payload = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeSummary(value: unknown): StudySummary {
  if (!value || typeof value !== "object") {
    return {
      summary: "",
      corePoints: [],
      studyTopics: [],
      actionItems: [],
    };
  }
  const payload = value as Record<string, unknown>;
  return {
    summary: safeString(payload.summary),
    corePoints: toStringArray(payload.core_points || payload.corePoints),
    studyTopics: toStringArray(payload.study_topics || payload.studyTopics),
    actionItems: toStringArray(payload.action_items || payload.actionItems),
  };
}

async function loadStudyFeed() {
  const posts = JSON.parse(await fetchText(STUDY_POSTS_URL)) as StudyPost[];
  if (!Array.isArray(posts)) {
    throw new Error("Study posts feed is not an array");
  }

  const bodyTargets = posts
    .filter((post) => safeString(post.fileName))
    .slice(0, MAX_BODY_POSTS);
  const bodyResults = await Promise.allSettled(
    bodyTargets.map(async (post) => {
      const fileName = safeString(post.fileName);
      const text = await fetchText(`${STUDY_BASE_URL}docs/${fileName}`, 12000);
      return {
        id: post.id,
        title: safeString(post.title),
        category: safeString(post.category),
        type: safeString(post.type),
        fileName,
        content: normalizeText(text),
      };
    })
  );

  const bodies = bodyResults.flatMap((result) =>
    result.status === "fulfilled" && result.value.content ? [result.value] : []
  );

  const feedIndex = posts
    .map((post, index) => {
      const title = safeString(post.title) || "제목 없음";
      const category = safeString(post.category) || "미분류";
      const type = safeString(post.type) || "text";
      const time = safeString(post.time);
      return `${index + 1}. [${category}/${type}] ${title}${time ? ` (${time})` : ""}`;
    })
    .join("\n");

  const bodyText = bodies
    .map((post) =>
      [
        `## ${post.title || post.fileName}`,
        `category=${post.category || "-"} type=${post.type || "-"}`,
        trimForPrompt(post.content, 3500),
      ].join("\n")
    )
    .join("\n\n---\n\n");

  const transcript = trimForPrompt(
    [
      `총 피드 수: ${posts.length}`,
      "전체 피드 목록:",
      feedIndex,
      "",
      `최근 본문 샘플 ${bodies.length}개:`,
      bodyText,
    ].join("\n"),
    MAX_PROMPT_CHARS
  );

  return {
    posts,
    bodies,
    transcript,
  };
}

async function summarizeStudyFeed(transcript: string) {
  const key = openAiApiKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = [
    "다음 주식 강의 사이트의 전체 피드 목록과 최근 본문을 읽고 JSON만 반환하세요.",
    "형식:",
    "{\"summary\":\"한국어 종합 요약\",",
    "\"core_points\":[\"핵심 정리 1\",\"핵심 정리 2\"],",
    "\"study_topics\":[\"반복해서 등장하는 학습 주제\"],",
    "\"action_items\":[\"사용자가 공부하거나 확인하면 좋은 항목\"]}",
    "강의/학습 맥락을 우선하고, 종목명이 나오면 종목명도 자연스럽게 포함하세요.",
    "",
    transcript,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel(),
      input: [
        {
          role: "system",
          content:
            "You summarize Korean stock education feeds and return strict JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI summary failed: HTTP ${response.status} ${errorText}`);
  }

  return normalizeSummary(parseJsonText(responseText(await response.json())));
}

export async function POST() {
  const { response } = await requireDiscussionAccessApi();
  if (response) return response;

  try {
    const { posts, bodies, transcript } = await loadStudyFeed();
    const summary = await summarizeStudyFeed(transcript);

    return NextResponse.json({
      sourceUrl: STUDY_DISPLAY_URL,
      fetchedAt: new Date().toISOString(),
      model: openAiModel(),
      postCount: posts.length,
      summarizedBodyCount: bodies.length,
      summary,
    });
  } catch (error) {
    console.error("Study summary error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "스터디 피드 정리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
