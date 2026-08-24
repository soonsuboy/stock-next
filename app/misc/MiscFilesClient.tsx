"use client";

import { put } from "@vercel/blob/client";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import type { MiscFile } from "@/lib/misc-files";

interface UploadTokenResponse {
  fileId: string;
  pathname: string;
  clientToken: string;
  maxFileSizeBytes: number;
  error?: string;
}

interface FilesResponse {
  files: MiscFile[];
  error?: string;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function readJson<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

export default function MiscFilesClient({
  initialFiles,
  maxFileSizeBytes,
  storageConfigured,
}: {
  initialFiles: MiscFile[];
  maxFileSizeBytes: number;
  storageConfigured: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState(initialFiles);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const maxFileSizeLabel = useMemo(
    () => formatBytes(maxFileSizeBytes),
    [maxFileSizeBytes]
  );

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setMessage("");
    setError("");
    setProgress(0);
  };

  const refreshFiles = async () => {
    const response = await fetch("/api/misc/files");
    const payload = await readJson<
      FilesResponse & { storageConfigured?: boolean; maxFileSizeBytes?: number }
    >(response, "파일 목록을 불러오지 못했습니다.");
    setFiles(payload.files || []);
  };

  const uploadFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || uploading) return;

    if (selectedFile.size > maxFileSizeBytes) {
      setError(`파일은 ${maxFileSizeLabel} 이하만 업로드할 수 있습니다.`);
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setProgress(0);

    try {
      const tokenResponse = await fetch("/api/misc/files/upload-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
          sizeBytes: selectedFile.size,
        }),
      });
      const tokenPayload = await readJson<UploadTokenResponse>(
        tokenResponse,
        "업로드 준비에 실패했습니다."
      );

      await put(tokenPayload.pathname, selectedFile, {
        access: "public",
        token: tokenPayload.clientToken,
        contentType: selectedFile.type || "application/octet-stream",
        multipart: selectedFile.size > 4 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          setProgress(Math.max(0, Math.min(100, Math.round(percentage))));
        },
      });

      const completeResponse = await fetch("/api/misc/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: tokenPayload.fileId }),
      });
      const completePayload = await readJson<FilesResponse>(
        completeResponse,
        "업로드 완료 처리에 실패했습니다."
      );

      setFiles(completePayload.files || []);
      setSelectedFile(null);
      setProgress(100);
      setMessage("파일을 업로드했습니다.");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "파일 업로드에 실패했습니다."
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (deletingId) return;

    setDeletingId(fileId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/misc/files?id=${encodeURIComponent(fileId)}`,
        { method: "DELETE" }
      );
      const payload = await readJson<FilesResponse>(
        response,
        "파일 삭제에 실패했습니다."
      );
      setFiles(payload.files || []);
      setMessage("파일을 삭제했습니다.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "파일 삭제에 실패했습니다."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
            기타
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
            첨부파일
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            로그인 계정별로 파일을 업로드하고 내려받을 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshFiles}
          className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          새로고침
        </button>
      </div>

      {!storageConfigured && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          파일 업로드를 사용하려면 Vercel Blob의 BLOB_READ_WRITE_TOKEN 환경변수가
          필요합니다. 현재 화면은 기존 파일 조회만 가능합니다.
        </div>
      )}

      {message && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={uploadFile}
        className="mb-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              파일 선택
            </span>
            <input
              ref={inputRef}
              type="file"
              onChange={chooseFile}
              disabled={!storageConfigured || uploading}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 file:mr-4 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:file:bg-slate-100 dark:file:text-slate-950"
            />
          </label>
          <button
            type="submit"
            disabled={!storageConfigured || !selectedFile || uploading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "업로드 중" : "업로드"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <span>최대 {maxFileSizeLabel}</span>
          {selectedFile && (
            <span className="font-semibold text-slate-900 dark:text-white">
              {selectedFile.name} · {formatBytes(selectedFile.size)}
            </span>
          )}
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {progress}%
            </p>
          </div>
        )}
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">
            파일 목록
          </h2>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {files.length}건
          </span>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">파일명</th>
                <th className="px-4 py-3">유형</th>
                <th className="px-4 py-3 text-right">용량</th>
                <th className="px-4 py-3">업로드 시간</th>
                <th className="px-5 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    업로드된 파일이 없습니다.
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr
                    key={file.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="max-w-md px-5 py-4 font-bold text-slate-900 dark:text-white">
                      <span className="block truncate" title={file.fileName}>
                        {file.fileName}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {file.contentType || "-"}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {formatDate(file.uploadedAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {file.downloadUrl && (
                          <a
                            href={file.downloadUrl}
                            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
                          >
                            내려받기
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteFile(file.id)}
                          disabled={deletingId === file.id}
                          className="rounded bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
                        >
                          {deletingId === file.id ? "삭제 중" : "삭제"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
          {files.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              업로드된 파일이 없습니다.
            </div>
          ) : (
            files.map((file) => (
              <article key={file.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-black text-slate-950 dark:text-white">
                      {file.fileName}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {file.contentType || "application/octet-stream"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {formatDate(file.uploadedAt)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {file.downloadUrl && (
                    <a
                      href={file.downloadUrl}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-950"
                    >
                      내려받기
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteFile(file.id)}
                    disabled={deletingId === file.id}
                    className="rounded-lg bg-red-100 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50 dark:bg-red-950 dark:text-red-200"
                  >
                    {deletingId === file.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
