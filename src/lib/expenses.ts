import type { Pool, PoolClient } from "pg";
import { getDbPool } from "@/lib/db";
import { ensureUsersSchemaReady } from "@/lib/users";

export type ExpenseItem = {
  id: string;
  title: string;
  unitCost: number;
  quantity: number;
  note: string;
  paid: boolean;
};

export type ExpenseData = {
  eventName: string;
  referenceTotal: number;
  updatedAt: string;
  items: ExpenseItem[];
};

export type ExpenseHistoryEntry = {
  id: number;
  changedAt: string;
  page: string;
  pageLabel: string;
  actor: string;
  summary: string;
  details: string[];
};

export type ExpenseChangeContext = {
  page?: string;
  pageLabel?: string;
  actor?: string;
};

type ExpenseRow = {
  event_name: string;
  reference_total: number;
  updated_at: Date | string;
  items: unknown;
};

type ExpenseHistoryRow = {
  id: number;
  changed_at: Date | string;
  page_key: string;
  page_label: string;
  actor: string;
  summary: string;
  details: unknown;
};

type SanitizableExpensePayload = Omit<Partial<ExpenseData>, "items"> & {
  items?: Partial<ExpenseItem>[];
};

type DatabaseClient = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type NewExpenseHistoryEntry = Omit<ExpenseHistoryEntry, "id" | "changedAt">;

const MAX_HISTORY_DETAILS = 12;

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const defaultData: ExpenseData = {
  eventName: "Rincian Biaya Lamaran",
  referenceTotal: 0,
  updatedAt: new Date().toISOString(),
  items: [],
};

let schemaEnsured = false;

function toPositiveInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function formatRupiah(value: number) {
  return idrFormatter.format(value);
}

function sanitizeItem(item: Partial<ExpenseItem> | undefined, index: number): ExpenseItem {
  return {
    id:
      typeof item?.id === "string" && item.id.trim().length > 0
        ? item.id.trim()
        : `item-${index + 1}`,
    title:
      typeof item?.title === "string" && item.title.trim().length > 0
        ? item.title.trim()
        : "Biaya Baru",
    unitCost: toPositiveInteger(item?.unitCost),
    quantity: Math.max(0, toPositiveInteger(item?.quantity, 0)),
    note: typeof item?.note === "string" ? item.note : "",
    paid: item?.paid === true,
  };
}

function parseDatabaseItems(rawItems: unknown): Partial<ExpenseItem>[] | undefined {
  if (Array.isArray(rawItems)) {
    return rawItems as Partial<ExpenseItem>[];
  }

  if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as Partial<ExpenseItem>[];
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function parseHistoryDetails(rawDetails: unknown) {
  if (Array.isArray(rawDetails)) {
    return rawDetails
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  if (typeof rawDetails === "string") {
    try {
      const parsed = JSON.parse(rawDetails) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function sanitizeExpenseData(payload: SanitizableExpensePayload | undefined): ExpenseData {
  const normalizedItems =
    payload?.items?.map((item, index) => sanitizeItem(item, index)) ??
    defaultData.items.map((item) => ({ ...item }));

  return {
    eventName:
      typeof payload?.eventName === "string" && payload.eventName.trim().length > 0
        ? payload.eventName.trim()
        : defaultData.eventName,
    referenceTotal: toPositiveInteger(payload?.referenceTotal, defaultData.referenceTotal),
    updatedAt:
      typeof payload?.updatedAt === "string" && !Number.isNaN(Date.parse(payload.updatedAt))
        ? payload.updatedAt
        : new Date().toISOString(),
    items: normalizedItems,
  };
}

function mapRowToExpenseData(row: ExpenseRow) {
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : typeof row.updated_at === "string"
        ? row.updated_at
        : new Date().toISOString();

  return sanitizeExpenseData({
    eventName: row.event_name,
    referenceTotal: row.reference_total,
    updatedAt,
    items: parseDatabaseItems(row.items),
  });
}

function mapRowToExpenseHistory(row: ExpenseHistoryRow): ExpenseHistoryEntry {
  const changedAt =
    row.changed_at instanceof Date
      ? row.changed_at.toISOString()
      : typeof row.changed_at === "string"
        ? row.changed_at
        : new Date().toISOString();

  return {
    id: row.id,
    changedAt,
    page: row.page_key,
    pageLabel: row.page_label,
    actor: row.actor,
    summary: row.summary,
    details: parseHistoryDetails(row.details),
  };
}

function areItemsEquivalent(left: ExpenseItem, right: ExpenseItem) {
  return (
    left.title === right.title &&
    left.unitCost === right.unitCost &&
    left.quantity === right.quantity &&
    left.note === right.note &&
    left.paid === right.paid
  );
}

function toSentenceCase(value: string) {
  if (value.length === 0) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function detectExpenseChanges(
  currentData: ExpenseData,
  nextData: ExpenseData,
  context: ExpenseChangeContext
): NewExpenseHistoryEntry | null {
  const details: string[] = [];
  const summaryParts: string[] = [];
  const currentMap = new Map(currentData.items.map((item) => [item.id, item]));
  const nextMap = new Map(nextData.items.map((item) => [item.id, item]));
  const addedItems = nextData.items.filter((item) => !currentMap.has(item.id));
  const removedItems = currentData.items.filter((item) => !nextMap.has(item.id));
  let editedItems = 0;

  if (currentData.eventName !== nextData.eventName) {
    details.push(`Nama event diubah menjadi "${nextData.eventName}".`);
  }

  if (currentData.referenceTotal !== nextData.referenceTotal) {
    details.push(
      `Budget referensi berubah dari ${formatRupiah(currentData.referenceTotal)} ke ${formatRupiah(nextData.referenceTotal)}.`
    );
  }

  if (addedItems.length > 0) {
    const addedItemNames = addedItems.slice(0, 3).map((item) => item.title);
    const suffix = addedItems.length > 3 ? ` (+${addedItems.length - 3} item lain)` : "";
    details.push(`Item baru ditambahkan: ${addedItemNames.join(", ")}${suffix}.`);
  }

  if (removedItems.length > 0) {
    const removedItemNames = removedItems.slice(0, 3).map((item) => item.title);
    const suffix = removedItems.length > 3 ? ` (+${removedItems.length - 3} item lain)` : "";
    details.push(`Item dihapus: ${removedItemNames.join(", ")}${suffix}.`);
  }

  for (const nextItem of nextData.items) {
    const currentItem = currentMap.get(nextItem.id);
    if (!currentItem || areItemsEquivalent(currentItem, nextItem)) {
      continue;
    }

    editedItems += 1;

    if (currentItem.title !== nextItem.title) {
      details.push(`Nama item "${currentItem.title}" diubah menjadi "${nextItem.title}".`);
    }

    if (
      currentItem.unitCost !== nextItem.unitCost ||
      currentItem.quantity !== nextItem.quantity
    ) {
      details.push(
        `Item "${nextItem.title}" diperbarui dari ${formatRupiah(currentItem.unitCost)} x ${currentItem.quantity} menjadi ${formatRupiah(nextItem.unitCost)} x ${nextItem.quantity}.`
      );
    }

    const currentNote = currentItem.note.trim();
    const nextNote = nextItem.note.trim();
    if (currentNote !== nextNote) {
      details.push(
        nextNote.length > 0
          ? `Catatan item "${nextItem.title}" diperbarui.`
          : `Catatan item "${nextItem.title}" dihapus.`
      );
    }

    if (currentItem.paid !== nextItem.paid) {
      details.push(
        `Status pembayaran "${nextItem.title}" menjadi ${nextItem.paid ? "Done / Paid" : "Belum Dibayar"}.`
      );
    }
  }

  const previousIds = currentData.items.map((item) => item.id);
  const nextIds = nextData.items.map((item) => item.id);
  const sameLength = previousIds.length === nextIds.length;
  const sameSet = sameLength && previousIds.every((id) => nextMap.has(id));
  const orderChanged = sameSet && previousIds.some((id, index) => id !== nextIds[index]);

  if (orderChanged) {
    details.push("Urutan item pada tabel diubah.");
  }

  if (currentData.eventName !== nextData.eventName || currentData.referenceTotal !== nextData.referenceTotal) {
    summaryParts.push("ringkasan event diperbarui");
  }

  if (addedItems.length > 0) {
    summaryParts.push(`${addedItems.length} item ditambahkan`);
  }

  if (removedItems.length > 0) {
    summaryParts.push(`${removedItems.length} item dihapus`);
  }

  if (editedItems > 0) {
    summaryParts.push(`${editedItems} item diubah`);
  }

  if (orderChanged) {
    summaryParts.push("urutan item diperbarui");
  }

  if (details.length === 0) {
    return null;
  }

  const normalizedDetails =
    details.length > MAX_HISTORY_DETAILS
      ? [
          ...details.slice(0, MAX_HISTORY_DETAILS),
          `+${details.length - MAX_HISTORY_DETAILS} perubahan lainnya.`,
        ]
      : details;
  const summary =
    summaryParts.length > 0 ? toSentenceCase(summaryParts.join(", ")) : "Perubahan data disimpan.";

  return {
    page:
      typeof context.page === "string" && context.page.trim().length > 0
        ? context.page.trim()
        : "dashboard",
    pageLabel:
      typeof context.pageLabel === "string" && context.pageLabel.trim().length > 0
        ? context.pageLabel.trim()
        : "Dashboard Biaya",
    actor:
      typeof context.actor === "string" && context.actor.trim().length > 0
        ? context.actor.trim()
        : "admin",
    summary,
    details: normalizedDetails,
  };
}

async function ensureExpenseSchema(client: DatabaseClient) {
  if (schemaEnsured) {
    return;
  }

  await ensureUsersSchemaReady();

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_expense_data (
      user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
      event_name TEXT NOT NULL,
      reference_total INTEGER NOT NULL CHECK (reference_total >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      items JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_expense_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      page_key TEXT NOT NULL,
      page_label TEXT NOT NULL,
      actor TEXT NOT NULL,
      summary TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS user_expense_history_user_changed_at_idx
    ON user_expense_history (user_id, changed_at DESC, id DESC);
  `);

  schemaEnsured = true;
}

async function upsertExpenseData(client: DatabaseClient, userId: number, data: ExpenseData) {
  await client.query(
    `
      INSERT INTO user_expense_data (user_id, event_name, reference_total, updated_at, items)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (user_id) DO UPDATE
      SET event_name = EXCLUDED.event_name,
          reference_total = EXCLUDED.reference_total,
          updated_at = EXCLUDED.updated_at,
          items = EXCLUDED.items
    `,
    [userId, data.eventName, data.referenceTotal, data.updatedAt, JSON.stringify(data.items)]
  );
}

async function insertExpenseHistory(
  client: DatabaseClient,
  userId: number,
  entry: NewExpenseHistoryEntry
) {
  await client.query(
    `
      INSERT INTO user_expense_history (user_id, page_key, page_label, actor, summary, details)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [userId, entry.page, entry.pageLabel, entry.actor, entry.summary, JSON.stringify(entry.details)]
  );
}

async function getCurrentExpenseData(client: DatabaseClient, userId: number) {
  const result = await client.query<ExpenseRow>(
    `
      SELECT event_name, reference_total, updated_at, items
      FROM user_expense_data
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToExpenseData(result.rows[0]);
}

export function createEmptyExpenseData() {
  return sanitizeExpenseData({
    ...defaultData,
    items: [],
    updatedAt: new Date().toISOString(),
  });
}

export async function readExpenseData(userId: number) {
  const pool = getDbPool();
  await ensureExpenseSchema(pool);

  const existingData = await getCurrentExpenseData(pool, userId);
  if (existingData) {
    return existingData;
  }

  const seededData = createEmptyExpenseData();

  await upsertExpenseData(pool, userId, seededData);
  return seededData;
}

export async function writeExpenseData(
  userId: number,
  payload: Partial<ExpenseData>,
  context: ExpenseChangeContext = {}
) {
  const pool = getDbPool();
  await ensureExpenseSchema(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fallbackCurrentData = createEmptyExpenseData();
    const currentData = (await getCurrentExpenseData(client, userId)) ?? fallbackCurrentData;
    const nextData = sanitizeExpenseData({
      eventName: payload.eventName ?? currentData.eventName,
      referenceTotal: payload.referenceTotal ?? currentData.referenceTotal,
      items: payload.items ?? currentData.items,
      updatedAt: new Date().toISOString(),
    });

    await upsertExpenseData(client, userId, nextData);
    const historyEntry = detectExpenseChanges(currentData, nextData, context);
    if (historyEntry) {
      await insertExpenseHistory(client, userId, historyEntry);
    }

    await client.query("COMMIT");
    return nextData;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function readExpenseHistory(userId: number, limit = 40) {
  const pool = getDbPool();
  await ensureExpenseSchema(pool);
  await readExpenseData(userId);

  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(120, Math.floor(limit)))
    : 40;
  const result = await pool.query<ExpenseHistoryRow>(
    `
      SELECT id, changed_at, page_key, page_label, actor, summary, details
      FROM user_expense_history
      WHERE user_id = $1
      ORDER BY changed_at DESC, id DESC
      LIMIT $2
    `,
    [userId, normalizedLimit]
  );

  return result.rows.map((row) => mapRowToExpenseHistory(row));
}
