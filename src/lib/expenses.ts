import type { Pool } from "pg";
import { getDbPool } from "@/lib/db";

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

type ExpenseRow = {
  event_name: string;
  reference_total: number;
  updated_at: Date | string;
  items: unknown;
};

type SanitizableExpensePayload = Omit<Partial<ExpenseData>, "items"> & {
  items?: Partial<ExpenseItem>[];
};

const defaultData: ExpenseData = {
  eventName: "Rincian Biaya Lamaran Af&Zah",
  referenceTotal: 18000000,
  updatedAt: new Date().toISOString(),
  items: [
    {
      id: "bensin",
      title: "Bensin",
      unitCost: 800000,
      quantity: 2,
      note: "Avanza (PP)",
      paid: false,
    },
    {
      id: "tol",
      title: "Tol",
      unitCost: 900000,
      quantity: 2,
      note: "Estimasi pulang-pergi",
      paid: false,
    },
    {
      id: "makan-berat",
      title: "Makan Berat (1 Orang)",
      unitCost: 100000,
      quantity: 10,
      note: "10 x 100.000",
      paid: false,
    },
    {
      id: "oleh-oleh",
      title: "Oleh-oleh (Bandung)",
      unitCost: 1000000,
      quantity: 1,
      note: "Kurang lebih",
      paid: false,
    },
    {
      id: "penginapan",
      title: "Penginapan",
      unitCost: 200000,
      quantity: 12,
      note: "4 kamar x 3 malam (Jumat, Sabtu, Minggu)",
      paid: false,
    },
    {
      id: "cincin",
      title: "Cincin (Tunangan)",
      unitCost: 3500000,
      quantity: 1,
      note: "",
      paid: false,
    },
    {
      id: "dana-darurat",
      title: "Dana Darurat",
      unitCost: 3000000,
      quantity: 1,
      note: "",
      paid: false,
    },
  ],
};

let schemaEnsured = false;

function toPositiveInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.round(parsed);
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

async function ensureExpenseSchema(pool: Pool) {
  if (schemaEnsured) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense_data (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      event_name TEXT NOT NULL,
      reference_total INTEGER NOT NULL CHECK (reference_total >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      items JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);

  schemaEnsured = true;
}

async function upsertExpenseData(pool: Pool, data: ExpenseData) {
  await pool.query(
    `
      INSERT INTO expense_data (id, event_name, reference_total, updated_at, items)
      VALUES (1, $1, $2, $3, $4::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET event_name = EXCLUDED.event_name,
          reference_total = EXCLUDED.reference_total,
          updated_at = EXCLUDED.updated_at,
          items = EXCLUDED.items
    `,
    [data.eventName, data.referenceTotal, data.updatedAt, JSON.stringify(data.items)]
  );
}

async function getCurrentExpenseData(pool: Pool) {
  const result = await pool.query<ExpenseRow>(
    `
      SELECT event_name, reference_total, updated_at, items
      FROM expense_data
      WHERE id = 1
      LIMIT 1
    `
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToExpenseData(result.rows[0]);
}

export async function readExpenseData() {
  const pool = getDbPool();
  await ensureExpenseSchema(pool);

  const existingData = await getCurrentExpenseData(pool);
  if (existingData) {
    return existingData;
  }

  const seededData = sanitizeExpenseData({
    ...defaultData,
    items: defaultData.items.map((item) => ({ ...item })),
    updatedAt: new Date().toISOString(),
  });

  await upsertExpenseData(pool, seededData);
  return seededData;
}

export async function writeExpenseData(payload: Partial<ExpenseData>) {
  const pool = getDbPool();
  await ensureExpenseSchema(pool);

  const currentData = (await getCurrentExpenseData(pool)) ?? defaultData;
  const nextData = sanitizeExpenseData({
    eventName: payload.eventName ?? currentData.eventName,
    referenceTotal: payload.referenceTotal ?? currentData.referenceTotal,
    items: payload.items ?? currentData.items,
    updatedAt: new Date().toISOString(),
  });

  await upsertExpenseData(pool, nextData);
  return nextData;
}
