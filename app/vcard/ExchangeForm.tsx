"use client";

import { FormEvent, useState } from "react";

export default function ExchangeForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/vcard/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus("error");
      setMessage(body?.error || "저장하지 못했습니다.");
      return;
    }

    form.reset();
    setStatus("saved");
    setMessage("명함을 받았습니다. 나중에 Turso DB에서 확인할 수 있습니다.");
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          이름
          <input
            name="name"
            required
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0f1f3d] focus:ring-2 focus:ring-[#0f1f3d]/15"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          회사
          <input
            name="organization"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0f1f3d] focus:ring-2 focus:ring-[#0f1f3d]/15"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          직함
          <input
            name="title"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0f1f3d] focus:ring-2 focus:ring-[#0f1f3d]/15"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          휴대폰
          <input
            name="phone"
            inputMode="tel"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0f1f3d] focus:ring-2 focus:ring-[#0f1f3d]/15"
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs font-semibold text-slate-700">
        이메일
        <input
          name="email"
          type="email"
          className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0f1f3d] focus:ring-2 focus:ring-[#0f1f3d]/15"
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-700">
        메모
        <textarea
          name="note"
          rows={3}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0f1f3d] focus:ring-2 focus:ring-[#0f1f3d]/15"
        />
      </label>
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-11 rounded-md bg-[#0f1f3d] px-4 text-sm font-semibold text-white transition hover:bg-[#243b65] disabled:cursor-not-allowed disabled:opacity-65"
      >
        {status === "saving" ? "저장 중" : "내 명함 보내기"}
      </button>
      {message ? (
        <p
          className={`min-h-5 text-sm font-medium ${
            status === "error" ? "text-red-700" : "text-[#1a4d45]"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
