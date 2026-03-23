import { promises as fs } from "node:fs";
import path from "node:path";

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

const DATA_FILE_PATH = path.join(process.cwd(), "data", "expenses.json");

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

function sanitizeExpenseData(payload: Partial<ExpenseData> | undefined): ExpenseData {
  const normalizedItems =
    payload?.items?.map((item, index) => sanitizeItem(item, index)) ?? defaultData.items;

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

export async function readExpenseData() {
  try {
    const fileContent = await fs.readFile(DATA_FILE_PATH, "utf-8");
    const parsed = JSON.parse(fileContent) as Partial<ExpenseData>;
    return sanitizeExpenseData(parsed);
  } catch {
    await writeExpenseData(defaultData);
    return defaultData;
  }
}

export async function writeExpenseData(payload: Partial<ExpenseData>) {
  const normalizedData = sanitizeExpenseData(payload);
  normalizedData.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(DATA_FILE_PATH), { recursive: true });
  await fs.writeFile(DATA_FILE_PATH, `${JSON.stringify(normalizedData, null, 2)}\n`, "utf-8");
  return normalizedData;
}
