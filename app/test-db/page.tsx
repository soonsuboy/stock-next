import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TestDBPage() {
  let tables: string[] = [];
  let error: string | null = null;

  try {
    const result = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    tables = result.rows.map((row) => String(row.name));
  } catch (e) {
    error = String(e);
  }

  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">🧪 DB 연결 테스트</h1>
      {error ? (
        <div className="p-4 bg-red-100 text-red-800 rounded">
          <strong>에러:</strong>
          <pre className="mt-2 text-sm whitespace-pre-wrap">{error}</pre>
        </div>
      ) : (
        <div className="p-4 bg-green-100 text-green-800 rounded">
          <strong>✅ 연결 성공!</strong>
          <p className="mt-2">발견된 테이블:</p>
          <ul className="list-disc list-inside mt-1">
            {tables.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}