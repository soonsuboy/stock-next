import { db } from "@/lib/db";

type ScanPlatform = "ios" | "android" | "web" | "unknown";

let initialized = false;

export async function ensureVcardTables() {
  if (initialized) {
    return;
  }

  await db.batch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS business_card_scan_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          card_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          user_agent TEXT,
          ip_hash TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `,
      args: [],
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS business_card_exchanges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_card_id TEXT NOT NULL,
          name TEXT NOT NULL,
          organization TEXT,
          title TEXT,
          email TEXT,
          phone TEXT,
          note TEXT,
          source TEXT NOT NULL DEFAULT 'vcard_site',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `,
      args: [],
    },
  ]);

  initialized = true;
}

export async function recordVcardScan(input: {
  cardId: string;
  platform: ScanPlatform;
  userAgent?: string | null;
  ipHash?: string | null;
}) {
  await ensureVcardTables();
  await db.execute({
    sql: `
      INSERT INTO business_card_scan_events (card_id, platform, user_agent, ip_hash)
      VALUES (?, ?, ?, ?)
    `,
    args: [
      input.cardId,
      input.platform,
      input.userAgent || null,
      input.ipHash || null,
    ],
  });
}

export async function createBusinessCardExchange(input: {
  ownerCardId: string;
  name: string;
  organization?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
}) {
  await ensureVcardTables();
  await db.execute({
    sql: `
      INSERT INTO business_card_exchanges
        (owner_card_id, name, organization, title, email, phone, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      input.ownerCardId,
      input.name,
      input.organization || null,
      input.title || null,
      input.email || null,
      input.phone || null,
      input.note || null,
    ],
  });
}
