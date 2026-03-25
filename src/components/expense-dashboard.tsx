"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import type { ExpenseData, ExpenseItem } from "@/lib/expenses";

type FeedbackType = "success" | "error" | "info";
type SortOption =
  | "manual"
  | "highest"
  | "lowest"
  | "name"
  | "unpaid-first"
  | "paid-first";
type ChartMode = "donut" | "bar";

type FeedbackMessage = {
  type: FeedbackType;
  text: string;
};

type ItemEditorDraft = {
  title: string;
  unitCost: string;
  quantity: string;
  note: string;
  paid: boolean;
};

type ItemEditorErrors = {
  title?: string;
  unitCost?: string;
  quantity?: string;
};

type ChartItem = {
  id: string;
  title: string;
  subtotal: number;
  percentage: number;
  color: string;
};

type ChartTooltipState = {
  item: ChartItem;
  x: number;
  y: number;
  side: "left" | "right";
};

type ExpenseDashboardProps = {
  initialData: ExpenseData;
  initialIsAdmin: boolean;
};

type ExpensesApiResponse = {
  data?: Partial<ExpenseData>;
  error?: string;
};

type ExpensesPutRequest = ExpenseData & {
  meta: {
    page: string;
    pageLabel: string;
  };
};

type AuthSessionApiResponse = {
  isAdmin?: boolean;
  username?: string | null;
  error?: string;
};

const CHART_COLORS = [
  "#ff4d6d",
  "#ff6f91",
  "#ff8fab",
  "#c77dff",
  "#7b61ff",
  "#4cc9f0",
  "#00f5d4",
];

const EXPENSE_SYNC_INTERVAL_MS = 10000;

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  maximumFractionDigits: 1,
});

function formatRupiah(value: number) {
  return idrFormatter.format(value);
}

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function createItem(): ExpenseItem {
  return {
    id: globalThis.crypto.randomUUID(),
    title: "Biaya Baru",
    unitCost: 0,
    quantity: 0,
    note: "",
    paid: false,
  };
}

function updateNumericValue(rawValue: string, fallback = 0) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.round(value);
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function getCategoryLabel(title: string) {
  const text = normalizeText(title);

  if (text.includes("bensin") || text.includes("tol")) {
    return "Perjalanan";
  }
  if (text.includes("penginapan")) {
    return "Akomodasi";
  }
  if (text.includes("cincin")) {
    return "Momen Inti";
  }
  if (text.includes("makan") || text.includes("oleh")) {
    return "Konsumsi";
  }
  if (text.includes("darurat")) {
    return "Cadangan";
  }
  return "Lainnya";
}

function describeBudgetMood(delta: number) {
  if (delta === 0) {
    return "Komposisi anggaran pas dengan referensi awal.";
  }
  if (delta > 0) {
    return "Estimasi saat ini di atas referensi, cek item prioritas.";
  }
  return "Estimasi masih di bawah referensi, ruang cadangan masih aman.";
}

function createItemEditorDraft(item: ExpenseItem): ItemEditorDraft {
  return {
    title: item.title,
    unitCost: String(item.unitCost),
    quantity: String(item.quantity),
    note: item.note,
    paid: item.paid,
  };
}

function validateItemEditorDraft(draft: ItemEditorDraft): ItemEditorErrors {
  const errors: ItemEditorErrors = {};
  const title = draft.title.trim();
  const unitCostValue = Number(draft.unitCost);
  const quantityValue = Number(draft.quantity);

  if (!title) {
    errors.title = "Nama item wajib diisi.";
  }

  if (!draft.unitCost.trim()) {
    errors.unitCost = "Biaya satuan wajib diisi.";
  } else if (!Number.isFinite(unitCostValue) || unitCostValue < 0) {
    errors.unitCost = "Biaya satuan harus angka >= 0.";
  }

  if (!draft.quantity.trim()) {
    errors.quantity = "Qty wajib diisi.";
  } else if (!Number.isFinite(quantityValue) || quantityValue < 0) {
    errors.quantity = "Qty harus angka >= 0.";
  }

  return errors;
}

function sanitizeClientItem(item: Partial<ExpenseItem> | undefined, index: number): ExpenseItem {
  const rawId = typeof item?.id === "string" ? item.id.trim() : "";
  const rawTitle = typeof item?.title === "string" ? item.title.trim() : "";

  return {
    id: rawId.length > 0 ? rawId : `item-${index + 1}`,
    title: rawTitle.length > 0 ? rawTitle : "Biaya Baru",
    unitCost: updateNumericValue(String(item?.unitCost ?? 0), 0),
    quantity: Math.max(0, updateNumericValue(String(item?.quantity ?? 0), 0)),
    note: typeof item?.note === "string" ? item.note : "",
    paid: item?.paid === true,
  };
}

function sanitizeClientData(payload: Partial<ExpenseData> | undefined, fallback: ExpenseData): ExpenseData {
  const sourceItems = Array.isArray(payload?.items) ? payload.items : fallback.items;

  return {
    eventName:
      typeof payload?.eventName === "string" && payload.eventName.trim().length > 0
        ? payload.eventName.trim()
        : fallback.eventName,
    referenceTotal: updateNumericValue(
      String(payload?.referenceTotal ?? fallback.referenceTotal),
      fallback.referenceTotal
    ),
    updatedAt:
      typeof payload?.updatedAt === "string" && !Number.isNaN(Date.parse(payload.updatedAt))
        ? payload.updatedAt
        : fallback.updatedAt,
    items: sourceItems.map((item, index) => sanitizeClientItem(item, index)),
  };
}

async function parseJsonResponse<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function resolveApiErrorMessage(
  payload: {
    error?: string;
  } | null,
  fallback: string
) {
  if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
    return payload.error.trim();
  }

  return fallback;
}

function resolveRuntimeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback;
}

type DonutChartProps = {
  data: ChartItem[];
  total: number;
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  onTooltipMove: (item: ChartItem, x: number, y: number) => void;
  onTooltipLeave: () => void;
};

function DonutChart({
  data,
  total,
  highlightedId,
  onHighlight,
  onTooltipMove,
  onTooltipLeave,
}: DonutChartProps) {
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const segments = data.map((item, index) => {
    const length = item.percentage * circumference;
    const previousLength = data
      .slice(0, index)
      .reduce((sum, current) => sum + current.percentage * circumference, 0);

    return {
      ...item,
      length,
      dasharray: `${Math.max(length, 0)} ${Math.max(circumference - length, 0)}`,
      dashoffset: -previousLength,
    };
  });

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 260 260" className="donut-svg" role="img" aria-label="Chart anggaran">
        <circle cx="130" cy="130" r={radius} className="donut-track" />
        {segments.map((item) => {
          const isActive = highlightedId === item.id;

          return (
            <circle
              key={item.id}
              cx="130"
              cy="130"
              r={radius}
              className={`donut-segment ${isActive ? "is-active" : ""}`}
              stroke={item.color}
              strokeDasharray={item.dasharray}
              strokeDashoffset={item.dashoffset}
              onMouseEnter={(event) => {
                onHighlight(item.id);
                onTooltipMove(item, event.clientX, event.clientY);
              }}
              onMouseMove={(event) => onTooltipMove(item, event.clientX, event.clientY)}
              onMouseLeave={() => {
                onHighlight(null);
                onTooltipLeave();
              }}
              onFocus={() => onHighlight(item.id)}
              onBlur={() => {
                onHighlight(null);
                onTooltipLeave();
              }}
              onClick={() => onHighlight(highlightedId === item.id ? null : item.id)}
              tabIndex={0}
            />
          );
        })}
        <circle cx="130" cy="130" r="54" className="donut-hole" />
        <text x="130" y="122" textAnchor="middle" className="donut-caption">
          Total
        </text>
        <text x="130" y="148" textAnchor="middle" className="donut-value">
          {formatRupiah(total)}
        </text>
      </svg>
    </div>
  );
}

type BarChartProps = {
  data: ChartItem[];
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  onTooltipMove: (item: ChartItem, x: number, y: number) => void;
  onTooltipLeave: () => void;
};

function BarChart({
  data,
  highlightedId,
  onHighlight,
  onTooltipMove,
  onTooltipLeave,
}: BarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.subtotal), 1);

  return (
    <div className="bar-chart">
      {data.map((item) => {
        const width = `${(item.subtotal / maxValue) * 100}%`;
        const isActive = item.id === highlightedId;

        return (
          <button
            key={item.id}
            type="button"
            className={`bar-row ${isActive ? "is-active" : ""}`}
            onMouseEnter={(event) => {
              onHighlight(item.id);
              onTooltipMove(item, event.clientX, event.clientY);
            }}
            onMouseMove={(event) => onTooltipMove(item, event.clientX, event.clientY)}
            onMouseLeave={() => {
              onHighlight(null);
              onTooltipLeave();
            }}
            onFocus={() => onHighlight(item.id)}
            onBlur={() => {
              onHighlight(null);
              onTooltipLeave();
            }}
            onClick={() => onHighlight(highlightedId === item.id ? null : item.id)}
          >
            <span className="bar-label">{item.title}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width, background: item.color }} />
            </span>
            <span className="bar-value">{formatRupiah(item.subtotal)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ExpenseDashboard({
  initialData,
  initialIsAdmin,
}: ExpenseDashboardProps) {
  const [data, setData] = useState<ExpenseData>(initialData);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("manual");
  const [query, setQuery] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("donut");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [lastDraft, setLastDraft] = useState<ExpenseData | null>(null);
  const [chartTooltip, setChartTooltip] = useState<ChartTooltipState | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemEditorDraft, setItemEditorDraft] = useState<ItemEditorDraft | null>(null);
  const [itemEditorErrors, setItemEditorErrors] = useState<ItemEditorErrors>({});
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const itemEditorTitleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const syncOnMount = async () => {
      try {
        const [expenseResponse, sessionResponse] = await Promise.all([
          fetch("/api/expenses", { method: "GET", cache: "no-store" }),
          fetch("/api/auth/session", { method: "GET", cache: "no-store" }),
        ]);

        const expensePayload = await parseJsonResponse<ExpensesApiResponse>(expenseResponse);
        const sessionPayload = await parseJsonResponse<AuthSessionApiResponse>(sessionResponse);

        if (isCancelled) {
          return;
        }

        if (expenseResponse.ok && expensePayload) {
          setData((current) => sanitizeClientData(expensePayload.data, current));
        }

        if (sessionResponse.ok && sessionPayload) {
          const nextIsAdmin = sessionPayload.isAdmin === true;

          setIsAdmin(nextIsAdmin);
        } else if (!initialIsAdmin) {
          setIsAdmin(false);
        }
      } catch {
        if (!isCancelled) {
          setFeedback({
            type: "error",
            text: "Gagal sinkronisasi awal dengan server, menampilkan data terakhir yang tersedia.",
          });
        }
      }
    };

    void syncOnMount();

    return () => {
      isCancelled = true;
    };
  }, [initialIsAdmin]);

  const calculatedTotal = useMemo(() => {
    return data.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  }, [data.items]);

  const deltaFromReference = calculatedTotal - data.referenceTotal;

  const displayedItems = useMemo(() => {
    let output = [...data.items];
    const text = normalizeText(query);

    if (text.length > 0) {
      output = output.filter((item) => {
        const haystack = normalizeText(`${item.title} ${item.note}`);
        return haystack.includes(text);
      });
    }

    switch (sortOption) {
      case "highest":
        output.sort((a, b) => b.unitCost * b.quantity - (a.unitCost * a.quantity));
        break;
      case "lowest":
        output.sort((a, b) => a.unitCost * a.quantity - (b.unitCost * b.quantity));
        break;
      case "name":
        output.sort((a, b) => a.title.localeCompare(b.title, "id-ID"));
        break;
      case "unpaid-first":
        output = output.filter((item) => !item.paid);
        break;
      case "paid-first":
        output = output.filter((item) => item.paid);
        break;
      case "manual":
      default:
        break;
    }

    return output;
  }, [data.items, query, sortOption]);

  const colorById = useMemo(() => {
    return Object.fromEntries(
      data.items.map((item, index) => [item.id, CHART_COLORS[index % CHART_COLORS.length]])
    );
  }, [data.items]);

  const chartData = useMemo<ChartItem[]>(() => {
    const baseItems = displayedItems.length > 0 ? displayedItems : data.items;
    const total = baseItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);

    return baseItems.map((item) => {
      const subtotal = item.unitCost * item.quantity;
      return {
        id: item.id,
        title: item.title,
        subtotal,
        percentage: total === 0 ? 0 : subtotal / total,
        color: colorById[item.id] ?? CHART_COLORS[0],
      };
    });
  }, [displayedItems, data.items, colorById]);

  const highestCostItem = useMemo(() => {
    if (data.items.length === 0) {
      return null;
    }
    return data.items.reduce((top, item) => {
      const topValue = top.unitCost * top.quantity;
      const currentValue = item.unitCost * item.quantity;
      return currentValue > topValue ? item : top;
    });
  }, [data.items]);

  const averageCost = data.items.length === 0 ? 0 : calculatedTotal / data.items.length;

  const highlightedItem = useMemo(() => {
    if (!highlightedId) {
      return null;
    }
    return data.items.find((item) => item.id === highlightedId) ?? null;
  }, [data.items, highlightedId]);

  const clearFeedback = () => {
    if (feedback) {
      setFeedback(null);
    }
  };

  const showChartTooltip = useCallback((item: ChartItem, x: number, y: number) => {
    const horizontalOffset = 2;
    const verticalOffset = 2;
    const tooltipWidth = 206;
    const tooltipHeight = 62;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const side = x + horizontalOffset + tooltipWidth > viewportWidth ? "left" : "right";
    const nextX =
      side === "right"
        ? Math.min(x + horizontalOffset, viewportWidth - tooltipWidth - 8)
        : Math.max(8, x - tooltipWidth - horizontalOffset);
    const nextY = Math.max(
      8,
      Math.min(y + verticalOffset, viewportHeight - tooltipHeight - 8)
    );

    setChartTooltip({ item, x: nextX, y: nextY, side });
  }, []);

  const hideChartTooltip = useCallback(() => {
    setChartTooltip(null);
  }, []);

  const rememberDraft = () => {
    setLastDraft((snapshot) => snapshot ?? structuredClone(data));
  };

  const undoDraft = () => {
    if (lastDraft) {
      setData(lastDraft);
    }

    setEditingItemId(null);
    setItemEditorDraft(null);
    setItemEditorErrors({});
    setLastDraft(null);
    setFeedback({ type: "info", text: "Perubahan dibatalkan." });
  };

  const openItemEditor = (item: ExpenseItem) => {
    setEditingItemId(item.id);
    setItemEditorDraft(createItemEditorDraft(item));
    setItemEditorErrors({});
  };

  const closeItemEditor = useCallback(() => {
    setEditingItemId(null);
    setItemEditorDraft(null);
    setItemEditorErrors({});
  }, []);

  const saveItemEditor = () => {
    if (!editingItemId || !itemEditorDraft) {
      return;
    }

    const validationErrors = validateItemEditorDraft(itemEditorDraft);
    if (Object.keys(validationErrors).length > 0) {
      setItemEditorErrors(validationErrors);
      return;
    }

    const nextTitle = itemEditorDraft.title.trim();
    const nextUnitCost = updateNumericValue(itemEditorDraft.unitCost, 0);
    const nextQuantity = updateNumericValue(itemEditorDraft.quantity, 0);

    clearFeedback();
    rememberDraft();
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              title: nextTitle,
              unitCost: nextUnitCost,
              quantity: nextQuantity,
              note: itemEditorDraft.note,
              paid: itemEditorDraft.paid,
            }
          : item
      ),
    }));
    closeItemEditor();
    setFeedback({
      type: "info",
      text: "Perubahan item tersimpan di draft lokal. Klik Simpan Perubahan untuk permanen.",
    });
  };

  const addItem = () => {
    clearFeedback();
    rememberDraft();
    setData((current) => ({
      ...current,
      items: [...current.items, createItem()],
    }));
  };

  const duplicateItem = (itemId: string) => {
    clearFeedback();
    rememberDraft();
    setData((current) => {
      const index = current.items.findIndex((item) => item.id === itemId);
      if (index < 0) {
        return current;
      }

      const source = current.items[index];
      const copy: ExpenseItem = {
        ...source,
        id: globalThis.crypto.randomUUID(),
        title: `${source.title} Copy`,
      };

      const items = [...current.items];
      items.splice(index + 1, 0, copy);
      return { ...current, items };
    });
  };

  const removeItem = (itemId: string) => {
    clearFeedback();
    rememberDraft();
    setData((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));

    if (highlightedId === itemId) {
      setHighlightedId(null);
    }

    if (editingItemId === itemId) {
      closeItemEditor();
    }
  };

  const saveData = useCallback(() => {
    if (!isAdmin) {
      setFeedback({
        type: "error",
        text: "Akses admin diperlukan untuk menyimpan perubahan.",
      });
      return;
    }

    setFeedback({ type: "info", text: "Menyimpan perubahan ke server..." });

    startTransition(() => {
      void (async () => {
        const outgoingData: ExpenseData = {
          ...data,
          items: data.items.map((item) => ({ ...item })),
        };
        const requestBody: ExpensesPutRequest = {
          ...outgoingData,
          meta: {
            page: "dashboard",
            pageLabel: "Dashboard Biaya",
          },
        };

        try {
          const response = await fetch("/api/expenses", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          const payload = await parseJsonResponse<ExpensesApiResponse>(response);
          if (!response.ok) {
            throw new Error(
              resolveApiErrorMessage(payload, "Gagal menyimpan data. Silakan login ulang.")
            );
          }

          const updatedData = sanitizeClientData(payload?.data, outgoingData);
          setData(updatedData);
          closeItemEditor();
          setLastDraft(null);
          setFeedback({
            type: "success",
            text: "Perubahan berhasil disimpan dan tersinkron ke semua device.",
          });
        } catch (error) {
          setFeedback({
            type: "error",
            text: resolveRuntimeErrorMessage(error, "Gagal menyimpan data ke server."),
          });
        }
      })();
    });
  }, [closeItemEditor, data, isAdmin, startTransition]);

  useEffect(() => {
    if (lastDraft) {
      return;
    }

    const syncTimer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch("/api/expenses", {
            method: "GET",
            cache: "no-store",
          });

          if (!response.ok) {
            return;
          }

          const payload = await parseJsonResponse<ExpensesApiResponse>(response);
          if (!payload) {
            return;
          }

          setData((current) => {
            const syncedData = sanitizeClientData(payload.data, current);
            if (syncedData.updatedAt === current.updatedAt) {
              return current;
            }

            return syncedData;
          });
        } catch {
          // ignore temporary sync errors and try again in next interval
        }
      })();
    }, EXPENSE_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(syncTimer);
    };
  }, [lastDraft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        (target?.tagName === "SELECT" && !target.getAttribute("readonly"));

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (isAdmin && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveData();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdmin, saveData]);

  useEffect(() => {
    if (!editingItemId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    itemEditorTitleRef.current?.focus();

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingItemId(null);
        setItemEditorDraft(null);
        setItemEditorErrors({});
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [editingItemId]);

  const summaryRate =
    data.referenceTotal === 0 ? 0 : Math.round((calculatedTotal / data.referenceTotal) * 100);

  return (
    <div className="page-shell">
      <main className="content-wrap">
        <section className="hero-card hero-future hero-dashboard">
          <div className="hero-main">
            <div className="hero-topline">
            </div>
            <h1>{data.eventName}</h1>
            <p className="hero-copy">
              Monitoring Dashboard biaya lamaran real-time,
              dan visual analytics.
            </p>
            <div className="hero-chip-wrap">
              <p className="meta-chip">Terakhir diperbarui: {formatDate(data.updatedAt)}</p>
              <p className="meta-chip">
                {isAdmin ? "Mode Admin Aktif" : "Akses edit via profil kanan atas"}
              </p>
              <Link href="/history" className="meta-chip history-shortcut">
                Lihat History Perubahan
              </Link>
            </div>
            <div className="hero-metrics">
              <div className="metric-tile">
                <p className="metric-label">Total Tracking</p>
                <p className="metric-number">{formatRupiah(calculatedTotal)}</p>
              </div>
              <div className="metric-tile">
                <p className="metric-label">Budget Ratio</p>
                <p className="metric-number">{summaryRate}%</p>
              </div>
              <div className="metric-tile">
                <p className="metric-label">Data Stream</p>
                <p className="metric-number">{data.items.length} Item</p>
              </div>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <article className="stat-card stat-fancy">
            <p className="stat-label">Total Estimasi</p>
            <p className="stat-value">{formatRupiah(calculatedTotal)}</p>
            <p className="stat-note">Rekap otomatis seluruh kebutuhan lamaran.</p>
          </article>
          <article className="stat-card stat-fancy">
            <p className="stat-label">Referensi Awal</p>
            <p className="stat-value">{formatRupiah(data.referenceTotal)}</p>
            <p className="stat-note">Target acuan dari catatan awal Rencana.</p>
          </article>
          <article className="stat-card stat-fancy">
            <p className="stat-label">Rasio Anggaran</p>
            <p className="stat-value">{summaryRate}%</p>
            <div className="progress-track" aria-hidden>
              <div
                className="progress-fill"
                style={{ width: `${Math.max(0, Math.min(summaryRate, 160))}%` }}
              />
            </div>
            <p className="stat-note">{describeBudgetMood(deltaFromReference)}</p>
          </article>
        </section>

        <section className="insight-layout">
          <article className="panel chart-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Visual Breakdown</h2>
                <p className="panel-subtitle">
                  Klik chart atau legend untuk highlight komponen biaya tertentu.
                </p>
              </div>
              <div className="chart-switch">
                <button
                  type="button"
                  className={`button button-ghost ${chartMode === "donut" ? "is-selected" : ""}`}
                  onClick={() => {
                    hideChartTooltip();
                    setChartMode("donut");
                  }}
                >
                  Donut
                </button>
                <button
                  type="button"
                  className={`button button-ghost ${chartMode === "bar" ? "is-selected" : ""}`}
                  onClick={() => {
                    hideChartTooltip();
                    setChartMode("bar");
                  }}
                >
                  Bar
                </button>
              </div>
            </div>

            <div className="chart-stage">
              {chartMode === "donut" ? (
                <DonutChart
                  data={chartData}
                  total={calculatedTotal}
                  highlightedId={highlightedId}
                  onHighlight={setHighlightedId}
                  onTooltipMove={showChartTooltip}
                  onTooltipLeave={hideChartTooltip}
                />
              ) : (
                <BarChart
                  data={chartData}
                  highlightedId={highlightedId}
                  onHighlight={setHighlightedId}
                  onTooltipMove={showChartTooltip}
                  onTooltipLeave={hideChartTooltip}
                />
              )}
              {chartTooltip && (
                <div
                  className={`chart-tooltip ${chartTooltip.side === "left" ? "is-left" : "is-right"}`}
                  style={{ left: chartTooltip.x, top: chartTooltip.y }}
                  role="status"
                >
                  <span
                    className="chart-tooltip-dot"
                    style={{ backgroundColor: chartTooltip.item.color }}
                  />
                  <div>
                    <p className="chart-tooltip-title">{chartTooltip.item.title}</p>
                    <p className="chart-tooltip-value">
                      {formatRupiah(chartTooltip.item.subtotal)} |{" "}
                      {formatPercent(chartTooltip.item.percentage)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="legend-grid">
              {chartData.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`legend-item ${highlightedId === item.id ? "is-active" : ""}`}
                  onClick={() => setHighlightedId(highlightedId === item.id ? null : item.id)}
                >
                  <span className="legend-dot" style={{ backgroundColor: item.color }} />
                  <span className="legend-label">{item.title}</span>
                  <span className="legend-value">{formatRupiah(item.subtotal)}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel love-notes">
            <h2 className="panel-title">Mission Insights</h2>
            <div className="notes-grid">
              <div className="note-card">
                <p className="note-label">Komponen Tertinggi</p>
                <p className="note-value">
                  {highestCostItem ? highestCostItem.title : "Belum ada data"}
                </p>
                {highestCostItem && (
                  <p className="note-caption">
                    {formatRupiah(highestCostItem.unitCost * highestCostItem.quantity)}
                  </p>
                )}
              </div>
              <div className="note-card">
                <p className="note-label">Rata-rata per Item</p>
                <p className="note-value">{formatRupiah(averageCost)}</p>
                <p className="note-caption">Ideal untuk kontrol item berikutnya.</p>
              </div>
              <div className="note-card">
                <p className="note-label">Item Disorot</p>
                <p className="note-value">
                  {highlightedItem ? highlightedItem.title : "Tidak ada"}
                </p>
                <p className="note-caption">
                  {highlightedItem
                    ? `${getCategoryLabel(highlightedItem.title)} | ${formatRupiah(
                        highlightedItem.unitCost * highlightedItem.quantity
                      )}`
                    : "Pilih chart/legend untuk melihat detail."}
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Rincian Item Biaya Af&Zah</h2>
              <p className="panel-subtitle">
                Cari item, ubah urutan tampilan, lalu kelola data langsung dari tabel.
              </p>
            </div>
            <div className="head-actions">
              {isAdmin && (
                <button className="button button-ghost" type="button" onClick={addItem}>
                  Tambah Item
                </button>
              )}
            </div>
          </div>

          <div className="control-grid">
            <label className="control-field">
              Cari item
              <input
                ref={searchInputRef}
                className="input"
                placeholder="contoh: penginapan, cincin, tol"
                value={query}
                onChange={(event) => {
                  hideChartTooltip();
                  setQuery(event.target.value);
                }}
              />
              <span className="field-hint">Shortcut: tekan &quot;/&quot; untuk fokus ke kolom ini</span>
            </label>
            <label className="control-field">
              Urutkan
              <select
                className="input"
                value={sortOption}
                onChange={(event) => {
                  hideChartTooltip();
                  setSortOption(event.target.value as SortOption);
                }}
              >
                <option value="manual">Urutan awal</option>
                <option value="highest">Subtotal terbesar</option>
                <option value="lowest">Subtotal terkecil</option>
                <option value="name">Nama item (A-Z)</option>
                <option value="unpaid-first">Status bayar: hanya belum dibayar</option>
                <option value="paid-first">Status bayar: hanya sudah dibayar</option>
              </select>
            </label>
          </div>

          <div className="table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Biaya Satuan</th>
                  <th>Qty</th>
                  <th>Status Bayar</th>
                  <th>Subtotal</th>
                  {isAdmin && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => {
                  const subtotal = item.unitCost * item.quantity;
                  const isRowActive = highlightedId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={isRowActive ? "is-highlighted-row" : ""}
                    >
                      <td data-label="Item">
                        <div>
                          <p className="cell-title">{item.title}</p>
                          <p className="cell-pill">{getCategoryLabel(item.title)}</p>
                          {item.note.length > 0 && <p className="cell-note">{item.note}</p>}
                        </div>
                      </td>
                      <td data-label="Biaya Satuan">
                        <span className="cell-amount">{formatRupiah(item.unitCost)}</span>
                      </td>
                      <td data-label="Qty">
                        <span className="cell-amount">{item.quantity}</span>
                      </td>
                      <td data-label="Status Bayar">
                        <span className={`payment-pill ${item.paid ? "is-paid" : "is-unpaid"}`}>
                          {item.paid ? "Done / Paid" : "Belum Dibayar"}
                        </span>
                      </td>
                      <td data-label="Subtotal">
                        <span className="cell-amount">{formatRupiah(subtotal)}</span>
                      </td>
                      {isAdmin && (
                        <td data-label="Aksi">
                          <div className="admin-controls">
                            <button
                              className="button button-primary"
                              type="button"
                              onClick={() => openItemEditor(item)}
                            >
                              Edit
                            </button>
                            <button
                              className="button button-ghost"
                              type="button"
                              onClick={() => duplicateItem(item.id)}
                            >
                              Duplikat
                            </button>
                            <button
                              className="button button-danger"
                              type="button"
                              onClick={() => removeItem(item.id)}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="panel-footer">
            <div className="total-wrap">
              <p className="total-label">Grand Total</p>
              <p className="total-value">{formatRupiah(calculatedTotal)}</p>
            </div>
            <div className="footer-actions">
              {feedback && <p className={`feedback feedback-${feedback.type}`}>{feedback.text}</p>}
              {isAdmin && (
                <div className="footer-button-row">
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={undoDraft}
                    disabled={isPending || !lastDraft}
                  >
                    Batalkan
                  </button>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={saveData}
                    disabled={isPending}
                  >
                    Simpan Perubahan
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {isAdmin && editingItemId && itemEditorDraft && (
        <div
          className="item-editor-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeItemEditor();
            }
          }}
        >
          <section
            className="item-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-editor-title"
          >
            <div className="item-editor-head">
              <h3 id="item-editor-title">Edit Item</h3>
              <button
                className="button button-ghost item-editor-close"
                type="button"
                onClick={closeItemEditor}
              >
                Tutup
              </button>
            </div>

            <div className="item-editor-grid">
              <label className="field-label">
                Nama Item
                <input
                  ref={itemEditorTitleRef}
                  className="input"
                  value={itemEditorDraft.title}
                  onChange={(event) => {
                    setItemEditorDraft((current) =>
                      current ? { ...current, title: event.target.value } : current
                    );
                    setItemEditorErrors((current) => ({ ...current, title: undefined }));
                  }}
                />
                {itemEditorErrors.title && <span className="field-error">{itemEditorErrors.title}</span>}
              </label>

              <label className="field-label">
                Biaya Satuan
                <input
                  className="number-input"
                  type="number"
                  min={0}
                  step={1000}
                  value={itemEditorDraft.unitCost}
                  onChange={(event) => {
                    setItemEditorDraft((current) =>
                      current ? { ...current, unitCost: event.target.value } : current
                    );
                    setItemEditorErrors((current) => ({ ...current, unitCost: undefined }));
                  }}
                />
                {itemEditorErrors.unitCost && (
                  <span className="field-error">{itemEditorErrors.unitCost}</span>
                )}
              </label>

              <label className="field-label">
                Qty
                <input
                  className="number-input"
                  type="number"
                  min={0}
                  step={1}
                  value={itemEditorDraft.quantity}
                  onChange={(event) => {
                    setItemEditorDraft((current) =>
                      current ? { ...current, quantity: event.target.value } : current
                    );
                    setItemEditorErrors((current) => ({ ...current, quantity: undefined }));
                  }}
                />
                {itemEditorErrors.quantity && (
                  <span className="field-error">{itemEditorErrors.quantity}</span>
                )}
              </label>

              <label className="field-label item-editor-check">
                Status Pembayaran
                <span className="item-editor-check-row">
                  <input
                    type="checkbox"
                    checked={itemEditorDraft.paid}
                    onChange={(event) =>
                      setItemEditorDraft((current) =>
                        current ? { ...current, paid: event.target.checked } : current
                      )
                    }
                  />
                  Sudah dibayar (Done/Paid)
                </span>
              </label>

              <label className="field-label item-editor-wide">
                Catatan
                <textarea
                  className="textarea"
                  value={itemEditorDraft.note}
                  onChange={(event) =>
                    setItemEditorDraft((current) =>
                      current ? { ...current, note: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>

            <div className="item-editor-actions">
              <button className="button button-ghost" type="button" onClick={closeItemEditor}>
                Batal
              </button>
              <button className="button button-primary" type="button" onClick={saveItemEditor}>
                Simpan Item
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
