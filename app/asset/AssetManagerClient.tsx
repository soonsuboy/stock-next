"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  AssetData,
  AssetGroup,
  AssetPerson,
  AssetSnapshot,
} from "@/lib/assets";

type AssetKey = "crypto" | "koreaStock" | "usStock" | "realEstate" | "cash";

type AssetFormState = {
  personId: string;
  yearMonth: string;
  crypto: string;
  koreaStock: string;
  usStock: string;
  realEstate: string;
  cash: string;
};

const categories: Array<{
  key: AssetKey;
  label: string;
  color: string;
  softClass: string;
}> = [
  {
    key: "crypto",
    label: "코인",
    color: "#f97316",
    softClass: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-200",
  },
  {
    key: "koreaStock",
    label: "한국주식",
    color: "#2563eb",
    softClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  },
  {
    key: "usStock",
    label: "미국주식",
    color: "#16a34a",
    softClass: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200",
  },
  {
    key: "realEstate",
    label: "부동산",
    color: "#7c3aed",
    softClass: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  },
  {
    key: "cash",
    label: "현금",
    color: "#0f766e",
    softClass: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200",
  },
];

const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function emptyForm(personId: string, yearMonth = currentYearMonth()): AssetFormState {
  return {
    personId,
    yearMonth,
    crypto: "",
    koreaStock: "",
    usStock: "",
    realEstate: "",
    cash: "",
  };
}

function snapshotToForm(snapshot: AssetSnapshot): AssetFormState {
  return {
    personId: snapshot.personId,
    yearMonth: snapshot.yearMonth,
    crypto: String(snapshot.crypto),
    koreaStock: String(snapshot.koreaStock),
    usStock: String(snapshot.usStock),
    realEstate: String(snapshot.realEstate),
    cash: String(snapshot.cash),
  };
}

function parseAmount(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function formatCurrency(value: number) {
  return formatter.format(value);
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  return `${year}.${month}`;
}

function personName(people: AssetPerson[], personId: string) {
  return people.find((person) => person.id === personId)?.name || "알 수 없음";
}

function aggregateSnapshots(
  snapshots: AssetSnapshot[],
  memberIds: string[]
): AssetSnapshot[] {
  const memberSet = new Set(memberIds);
  const byMonth = new Map<string, AssetSnapshot>();

  for (const snapshot of snapshots) {
    if (!memberSet.has(snapshot.personId)) continue;

    const existing =
      byMonth.get(snapshot.yearMonth) ||
      ({
        personId: "group",
        yearMonth: snapshot.yearMonth,
        crypto: 0,
        koreaStock: 0,
        usStock: 0,
        realEstate: 0,
        cash: 0,
        total: 0,
        createdAt: null,
        updatedAt: null,
      } satisfies AssetSnapshot);

    const next = {
      ...existing,
      crypto: existing.crypto + snapshot.crypto,
      koreaStock: existing.koreaStock + snapshot.koreaStock,
      usStock: existing.usStock + snapshot.usStock,
      realEstate: existing.realEstate + snapshot.realEstate,
      cash: existing.cash + snapshot.cash,
    };

    byMonth.set(snapshot.yearMonth, {
      ...next,
      total:
        next.crypto +
        next.koreaStock +
        next.usStock +
        next.realEstate +
        next.cash,
    });
  }

  return Array.from(byMonth.values()).sort((a, b) =>
    a.yearMonth.localeCompare(b.yearMonth)
  );
}

function PieChart({
  snapshot,
  group,
}: {
  snapshot: AssetSnapshot | null;
  group: AssetGroup | null;
}) {
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const total = snapshot?.total || 0;
  const values = categories.map((category) => ({
    ...category,
    value: snapshot ? snapshot[category.key] : 0,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            그룹 자산 비율
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {snapshot
              ? `${group?.name || "선택 그룹"} · ${formatMonth(snapshot.yearMonth)}`
              : "선택 그룹의 입력 내역이 없습니다"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            그룹 총자산
          </p>
          <p className="text-xl font-black text-slate-950 dark:text-white">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:items-center">
        <div className="relative mx-auto h-56 w-56">
          <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="34"
            />
            {total > 0 &&
              values.map((item) => {
                const dash = (item.value / total) * circumference;
                const strokeDasharray = `${dash} ${circumference - dash}`;
                const strokeDashoffset = -offset;
                offset += dash;

                return (
                  <circle
                    key={item.key}
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="34"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              TOTAL
            </span>
            <span className="mt-1 text-lg font-black text-slate-950 dark:text-white">
              {numberFormatter.format(total)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {values.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.label}
                </span>
                <span className="ml-auto text-sm font-black text-slate-700 dark:text-slate-200">
                  {formatPercent(item.value, total)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedBarChart({ snapshots }: { snapshots: AssetSnapshot[] }) {
  const recentSnapshots = snapshots.slice(-12);
  const maxTotal = Math.max(1, ...recentSnapshots.map((snapshot) => snapshot.total));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            그룹 월별 구성 변화
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            선택 그룹의 최근 12개월 누적 세로막대
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.key}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.label}
            </span>
          ))}
        </div>
      </div>

      {recentSnapshots.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          선택 그룹 구성원의 월별 자산을 입력하면 그래프가 표시됩니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex h-80 min-w-[720px] items-end gap-4 border-b border-slate-200 pb-9 dark:border-slate-800">
            {recentSnapshots.map((snapshot) => {
              const height = Math.max(14, (snapshot.total / maxTotal) * 230);

              return (
                <div
                  key={snapshot.yearMonth}
                  className="relative flex flex-1 flex-col items-center"
                >
                  <div
                    className="flex w-full max-w-16 flex-col-reverse overflow-hidden rounded-t-md bg-slate-100 dark:bg-slate-800"
                    style={{ height }}
                    title={`${formatMonth(snapshot.yearMonth)} ${formatCurrency(snapshot.total)}`}
                  >
                    {categories.map((category) => {
                      const value = snapshot[category.key];
                      const segmentHeight =
                        snapshot.total > 0
                          ? Math.max(value > 0 ? 2 : 0, (value / snapshot.total) * height)
                          : 0;

                      return (
                        <div
                          key={category.key}
                          style={{
                            height: segmentHeight,
                            backgroundColor: category.color,
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="absolute -bottom-7 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {formatMonth(snapshot.yearMonth)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssetManagerClient({
  initialData,
}: {
  initialData: AssetData;
}) {
  const [data, setData] = useState(initialData);
  const [selectedGroupId, setSelectedGroupId] = useState(
    initialData.groups[0]?.id || ""
  );
  const [newPersonName, setNewPersonName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState(
    initialData.groups[0]?.id || ""
  );
  const [editingGroupName, setEditingGroupName] = useState(
    initialData.groups[0]?.name || ""
  );
  const [editingMemberIds, setEditingMemberIds] = useState<string[]>(
    initialData.groups[0]?.memberIds || []
  );
  const [form, setForm] = useState<AssetFormState>(() => {
    const personId = initialData.people[0]?.id || "";
    const current = initialData.snapshots.find(
      (snapshot) =>
        snapshot.personId === personId && snapshot.yearMonth === currentYearMonth()
    );
    return current ? snapshotToForm(current) : emptyForm(personId);
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedGroup =
    data.groups.find((group) => group.id === selectedGroupId) ||
    data.groups[0] ||
    null;
  const groupedSnapshots = useMemo(
    () => aggregateSnapshots(data.snapshots, selectedGroup?.memberIds || []),
    [data.snapshots, selectedGroup]
  );
  const currentGroupSnapshot = groupedSnapshots.at(-1) || null;
  const selectedSnapshot = useMemo(
    () =>
      data.snapshots.find(
        (snapshot) =>
          snapshot.personId === form.personId &&
          snapshot.yearMonth === form.yearMonth
      ) || null,
    [data.snapshots, form.personId, form.yearMonth]
  );
  const formTotal = categories.reduce(
    (sum, category) => sum + (parseAmount(form[category.key]) ?? 0),
    0
  );

  const applyData = (nextData: AssetData) => {
    setData(nextData);
    if (!nextData.groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(nextData.groups[0]?.id || "");
    }
    if (!nextData.people.some((person) => person.id === form.personId)) {
      setForm(emptyForm(nextData.people[0]?.id || "", form.yearMonth));
    }
  };

  const loadSnapshotIntoForm = (personId: string, yearMonth: string) => {
    const snapshot = data.snapshots.find(
      (item) => item.personId === personId && item.yearMonth === yearMonth
    );
    setForm(snapshot ? snapshotToForm(snapshot) : emptyForm(personId, yearMonth));
    setMessage("");
    setError("");
  };

  const updateField = (key: keyof AssetFormState, value: string) => {
    if (key === "personId") {
      loadSnapshotIntoForm(value, form.yearMonth);
      return;
    }
    if (key === "yearMonth") {
      loadSnapshotIntoForm(form.personId, value);
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const requestJson = async (
    url: string,
    options: RequestInit,
    fallbackMessage: string
  ) => {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(url, options);
      const nextData = (await response.json()) as AssetData & { error?: string };
      if (!response.ok) {
        throw new Error(nextData.error || fallbackMessage);
      }
      applyData(nextData);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : fallbackMessage
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createPerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await requestJson(
      "/api/asset/people",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPersonName }),
      },
      "사람 추가에 실패했습니다."
    );
    if (ok) {
      setNewPersonName("");
      setMessage("사람을 추가했습니다.");
    }
  };

  const deletePerson = async (personId: string) => {
    const ok = await requestJson(
      `/api/asset/people?id=${encodeURIComponent(personId)}`,
      { method: "DELETE" },
      "사람 삭제에 실패했습니다."
    );
    if (ok) setMessage("사람을 삭제했습니다.");
  };

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await requestJson(
      "/api/asset/groups",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          memberIds: data.people.map((person) => person.id),
        }),
      },
      "그룹 추가에 실패했습니다."
    );
    if (ok) {
      setNewGroupName("");
      setMessage("그룹을 추가했습니다.");
    }
  };

  const chooseEditingGroup = (groupId: string) => {
    const group = data.groups.find((item) => item.id === groupId);
    setEditingGroupId(groupId);
    setEditingGroupName(group?.name || "");
    setEditingMemberIds(group?.memberIds || []);
  };

  const toggleEditingMember = (personId: string) => {
    setEditingMemberIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  };

  const saveGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await requestJson(
      "/api/asset/groups",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingGroupId,
          name: editingGroupName,
          memberIds: editingMemberIds,
        }),
      },
      "그룹 저장에 실패했습니다."
    );
    if (ok) {
      setSelectedGroupId(editingGroupId);
      setMessage("그룹을 저장했습니다.");
    }
  };

  const deleteGroup = async () => {
    const ok = await requestJson(
      `/api/asset/groups?id=${encodeURIComponent(editingGroupId)}`,
      { method: "DELETE" },
      "그룹 삭제에 실패했습니다."
    );
    if (ok) {
      const remaining = data.groups.find((group) => group.id !== editingGroupId);
      chooseEditingGroup(remaining?.id || "");
      setMessage("그룹을 삭제했습니다.");
    }
  };

  const saveSnapshot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const values = Object.fromEntries(
      categories.map((category) => [category.key, parseAmount(form[category.key])])
    );

    if (!form.personId || Object.values(values).some((value) => value === null)) {
      setError("사람을 선택하고 금액은 0 이상의 숫자로 입력해주세요.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: form.personId,
          yearMonth: form.yearMonth,
          ...values,
        }),
      });

      const nextData = (await response.json()) as AssetData & { error?: string };
      if (!response.ok) {
        throw new Error(nextData.error || "자산 저장에 실패했습니다.");
      }

      applyData(nextData);
      setMessage(
        `${personName(data.people, form.personId)} ${formatMonth(form.yearMonth)} 자산을 저장했습니다.`
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "자산 저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSnapshot = async () => {
    if (!selectedSnapshot) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/asset?personId=${encodeURIComponent(selectedSnapshot.personId)}&yearMonth=${encodeURIComponent(selectedSnapshot.yearMonth)}`,
        { method: "DELETE" }
      );
      const nextData = (await response.json()) as AssetData & { error?: string };
      if (!response.ok) {
        throw new Error(nextData.error || "자산 삭제에 실패했습니다.");
      }

      applyData(nextData);
      setForm(emptyForm(form.personId, form.yearMonth));
      setMessage(`${formatMonth(selectedSnapshot.yearMonth)} 자산을 삭제했습니다.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "자산 삭제에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-300">
            Asset Management
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            가구별 월별 자산관리
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            사람별 계좌 자산을 입력하고, 그룹 단위로 합산해 흐름을 봅니다.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-right dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            선택 그룹 최근 총자산
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
            {formatCurrency(currentGroupSnapshot?.total || 0)}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <label className="block max-w-sm">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            그래프 그룹
          </span>
          <select
            value={selectedGroup?.id || ""}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              사람 관리
            </h2>
            <form onSubmit={createPerson} className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={newPersonName}
                onChange={(event) => setNewPersonName(event.target.value)}
                placeholder="아빠, 엄마, 아이"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                추가
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.people.map((person) => (
                <span
                  key={person.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {person.name}
                  <button
                    type="button"
                    disabled={data.people.length <= 1 || busy}
                    onClick={() => deletePerson(person.id)}
                    className="text-slate-400 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`${person.name} 삭제`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              그룹 관리
            </h2>
            <form onSubmit={createGroup} className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="우리 가구, 부모님, 아이들"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                추가
              </button>
            </form>

            <form onSubmit={saveGroup} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  수정할 그룹
                </span>
                <select
                  value={editingGroupId}
                  onChange={(event) => chooseEditingGroup(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {data.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                value={editingGroupName}
                onChange={(event) => setEditingGroupName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                {data.people.map((person) => (
                  <label
                    key={person.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={editingMemberIds.includes(person.id)}
                      onChange={() => toggleEditingMember(person.id)}
                      className="h-4 w-4"
                    />
                    {person.name}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="submit"
                  disabled={busy || !editingGroupId}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  그룹 저장
                </button>
                <button
                  type="button"
                  disabled={busy || data.groups.length <= 1}
                  onClick={deleteGroup}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                >
                  삭제
                </button>
              </div>
            </form>
          </section>

          <form
            onSubmit={saveSnapshot}
            className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  사람별 월별 입력
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  같은 사람과 같은 월은 저장 시 수정됩니다.
                </p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                KRW
              </span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  사람
                </span>
                <select
                  required
                  value={form.personId}
                  onChange={(event) => updateField("personId", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {data.people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  기준 월
                </span>
                <input
                  type="month"
                  required
                  value={form.yearMonth}
                  onChange={(event) => updateField("yearMonth", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
            </div>

            <div className="space-y-3">
              {categories.map((category) => (
                <label key={category.key} className="block">
                  <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.label}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs ${category.softClass}`}>
                      {formatPercent(parseAmount(form[category.key]) ?? 0, formTotal)}
                    </span>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form[category.key]}
                    onChange={(event) => updateField(category.key, event.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  입력 합계
                </span>
                <span className="text-lg font-black text-slate-950 dark:text-white">
                  {formatCurrency(formTotal)}
                </span>
              </div>
            </div>

            {message && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                {message}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "저장 중" : "저장"}
              </button>
              <button
                type="button"
                disabled={!selectedSnapshot || saving}
                onClick={deleteSnapshot}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                삭제
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <PieChart snapshot={currentGroupSnapshot} group={selectedGroup} />
          <StackedBarChart snapshots={groupedSnapshots} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            사람별 입력 내역
          </h2>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {data.snapshots.length}건
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-3 pr-3">월</th>
                <th className="px-3 py-3">사람</th>
                {categories.map((category) => (
                  <th key={category.key} className="px-3 py-3 text-right">
                    {category.label}
                  </th>
                ))}
                <th className="py-3 pl-3 text-right">총자산</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshots.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    아직 입력된 자산 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                data.snapshots
                  .slice()
                  .reverse()
                  .map((snapshot) => (
                    <tr
                      key={`${snapshot.personId}:${snapshot.yearMonth}`}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-3 pr-3 font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() =>
                            loadSnapshotIntoForm(snapshot.personId, snapshot.yearMonth)
                          }
                          className="rounded px-2 py-1 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {formatMonth(snapshot.yearMonth)}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                        {personName(data.people, snapshot.personId)}
                      </td>
                      {categories.map((category) => (
                        <td
                          key={category.key}
                          className="px-3 py-3 text-right text-slate-600 dark:text-slate-300"
                        >
                          {formatCurrency(snapshot[category.key])}
                        </td>
                      ))}
                      <td className="py-3 pl-3 text-right font-black text-slate-950 dark:text-white">
                        {formatCurrency(snapshot.total)}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
