"use client";

import { Pagination } from "@heroui/react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { MdAdd, MdEdit, MdRemove } from "react-icons/md";
import type { ExpenseData, ExpenseItem } from "@/lib/expenses";

type FeedbackType = "success" | "error" | "info";
type SortOption =
  | "manual"
  | "highest"
  | "lowest"
  | "name"
  | "unpaid-first"
  | "paid-first";
type ChartMode = "donut" | "chart";

type FeedbackMessage = {
  type: FeedbackType;
  text: string;
};

type ItemEditorDraft = {
  title: string;
  category: string;
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

type ItemEditorMode = "edit" | "create";

type DeleteItemDialog = {
  id: string;
  title: string;
};

type ChartItem = {
  id: string;
  title: string;
  category: string;
  subtotal: number;
  percentage: number;
  color: string;
};

type ChartTooltipState = {
  item: ChartItem;
  x: number;
  y: number;
  arrowX: number;
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
  isViewOnly?: boolean;
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
const CHART_ITEMS_PER_PAGE = 4;
const MOBILE_TABLE_BREAKPOINT_QUERY = "(max-width: 760px)";
const MOBILE_TABLE_ITEMS_PER_PAGE = 3;
const DESKTOP_TABLE_ITEMS_PER_PAGE = 10;

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  maximumFractionDigits: 1,
});
const compactNumberFormatter = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatRupiah(value: number) {
  return idrFormatter.format(value);
}

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value);
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

function updateNumericValue(rawValue: string, fallback = 0) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.round(value);
}

function toDigitsOnly(rawValue: string) {
  return rawValue.replace(/\D+/g, "");
}

function formatWithThousandDots(rawValue: string) {
  const digits = toDigitsOnly(rawValue);

  if (!digits) {
    return "";
  }

  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  return normalizedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseFormattedInteger(rawValue: string) {
  const digits = toDigitsOnly(rawValue);

  if (!digits) {
    return Number.NaN;
  }

  return Number.parseInt(digits, 10);
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function getItemInitials(title: string) {
  const segments = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (segments.length === 0) {
    return "?";
  }

  const initials = segments
    .slice(0, 2)
    .map((segment) => segment.slice(0, 1).toUpperCase())
    .join("");

  return initials || title.trim().slice(0, 1).toUpperCase() || "?";
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

function resolveCategoryLabel(item: Pick<ExpenseItem, "title" | "category">) {
  const manualCategory = item.category.trim();
  return manualCategory.length > 0 ? manualCategory : getCategoryLabel(item.title);
}

function createItemEditorDraft(item: ExpenseItem): ItemEditorDraft {
  return {
    title: item.title,
    category: item.category,
    unitCost: formatWithThousandDots(String(item.unitCost)),
    quantity: String(item.quantity),
    note: item.note,
    paid: item.paid,
  };
}

function createNewItemEditorDraft(): ItemEditorDraft {
  return {
    title: "",
    category: "",
    unitCost: "",
    quantity: "",
    note: "",
    paid: false,
  };
}

function validateItemEditorDraft(draft: ItemEditorDraft): ItemEditorErrors {
  const errors: ItemEditorErrors = {};
  const title = draft.title.trim();
  const unitCostValue = parseFormattedInteger(draft.unitCost);
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
    category: typeof item?.category === "string" ? item.category.trim() : "",
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

type TrendChartProps = {
  data: ChartItem[];
  maxSubtotal: number;
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  rankOffset?: number;
};

function TrendChart({
  data,
  maxSubtotal,
  highlightedId,
  onHighlight,
  rankOffset = 0,
}: TrendChartProps) {
  const maxValue = Math.max(maxSubtotal, 1);

  if (data.length === 0) {
    return (
      <div className="trend-chart-shell is-empty">
        <div className="trend-chart-empty">
          <p className="trend-chart-empty-title">Belum ada data visual</p>
          <p className="trend-chart-empty-copy">
            Tambahkan item biaya terlebih dahulu agar chart bisa menampilkan distribusi pengeluaran.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="trend-chart-shell">
      <div className="trend-chart-head">
        <div>
          <p className="trend-chart-eyebrow">Cost Spectrum</p>
          <p className="trend-chart-title">
            Ranking komponen biaya paling dominan dengan fokus visual yang lebih tegas.
          </p>
        </div>
        <div className="trend-chart-summary">
          <span className="trend-chart-summary-label">Peak Spend</span>
          <span className="trend-chart-summary-value">{formatCompactNumber(maxValue)}</span>
        </div>
      </div>

      <div className="trend-chart-list" role="list" aria-label="Ranking komponen biaya">
        {data.map((item, index) => {
          const isActive = highlightedId === item.id;
          const fillWidth = maxValue === 0 ? 14 : Math.max((item.subtotal / maxValue) * 100, 14);
          const categoryLabel = item.category;
          const badgeLabel = getItemInitials(item.title);

          return (
            <button
              key={item.id}
              type="button"
              className={`trend-chart-row ${isActive ? "is-active" : ""}`}
              aria-label={`${item.title}, ${formatRupiah(item.subtotal)}, ${formatPercent(item.percentage)}`}
              onMouseEnter={() => {
                onHighlight(item.id);
              }}
              onMouseLeave={() => {
                onHighlight(null);
              }}
              onFocus={() => {
                onHighlight(item.id);
              }}
              onBlur={() => {
                onHighlight(null);
              }}
              onClick={() => onHighlight(highlightedId === item.id ? null : item.id)}
            >
              <span className="trend-chart-rank-wrap">
                <span className="trend-chart-rank">{String(rankOffset + index + 1).padStart(2, "0")}</span>
                <span
                  className="trend-chart-avatar"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${item.color}, ${item.color}99)`,
                    boxShadow: `0 0 24px ${item.color}44`,
                  }}
                >
                  {badgeLabel}
                </span>
              </span>

              <span className="trend-chart-content">
                <span className="trend-chart-row-head">
                  <span className="trend-chart-copy">
                    <span className="trend-chart-item-title">{item.title}</span>
                    <span className="trend-chart-item-meta">
                      {categoryLabel} | {formatPercent(item.percentage)}
                    </span>
                  </span>
                  <span className="trend-chart-value-wrap">
                    <span className="trend-chart-value-compact">{formatCompactNumber(item.subtotal)}</span>
                    <span className="trend-chart-value-full">{formatRupiah(item.subtotal)}</span>
                  </span>
                </span>

                <span className="trend-chart-track" aria-hidden="true">
                  <span
                    className="trend-chart-fill"
                    style={{
                      width: `${fillWidth}%`,
                      background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}cc 100%)`,
                      boxShadow: `0 0 28px ${item.color}44`,
                    }}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
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
  const [chartPage, setChartPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [isMobileTableViewport, setIsMobileTableViewport] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [lastDraft, setLastDraft] = useState<ExpenseData | null>(null);
  const [chartTooltip, setChartTooltip] = useState<ChartTooltipState | null>(null);
  const [itemEditorMode, setItemEditorMode] = useState<ItemEditorMode>("edit");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemEditorDraft, setItemEditorDraft] = useState<ItemEditorDraft | null>(null);
  const [itemEditorErrors, setItemEditorErrors] = useState<ItemEditorErrors>({});
  const [deleteItemDialog, setDeleteItemDialog] = useState<DeleteItemDialog | null>(null);
  const [isReferenceEditing, setIsReferenceEditing] = useState(false);
  const [referenceTotalDraft, setReferenceTotalDraft] = useState(
    formatWithThousandDots(String(initialData.referenceTotal))
  );
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const itemEditorTitleRef = useRef<HTMLInputElement | null>(null);
  const deleteItemConfirmRef = useRef<HTMLButtonElement | null>(null);
  const isItemEditorOpen = itemEditorDraft !== null;
  const isDeleteItemDialogOpen = deleteItemDialog !== null;
  const isAnyEditorDialogOpen = isItemEditorOpen || isDeleteItemDialogOpen;

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
          const nextIsAdmin =
            sessionPayload.isAdmin === true && sessionPayload.isViewOnly !== true;

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

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_TABLE_BREAKPOINT_QUERY);
    const syncViewport = () => {
      setIsMobileTableViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

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
  const tableItemsPerPage = isMobileTableViewport
    ? MOBILE_TABLE_ITEMS_PER_PAGE
    : DESKTOP_TABLE_ITEMS_PER_PAGE;
  const tableTotalPages = Math.max(1, Math.ceil(displayedItems.length / tableItemsPerPage));
  const paginatedDisplayedItems = useMemo(() => {
    const start = (tablePage - 1) * tableItemsPerPage;
    return displayedItems.slice(start, start + tableItemsPerPage);
  }, [displayedItems, tableItemsPerPage, tablePage]);

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
        category: resolveCategoryLabel(item),
        subtotal,
        percentage: total === 0 ? 0 : subtotal / total,
        color: colorById[item.id] ?? CHART_COLORS[0],
      };
    });
  }, [displayedItems, data.items, colorById]);
  const rankedChartData = useMemo(
    () => [...chartData].sort((left, right) => right.subtotal - left.subtotal),
    [chartData]
  );
  const chartTotalPages = Math.max(1, Math.ceil(rankedChartData.length / CHART_ITEMS_PER_PAGE));
  const paginatedRankedChartData = useMemo(() => {
    const start = (chartPage - 1) * CHART_ITEMS_PER_PAGE;
    return rankedChartData.slice(start, start + CHART_ITEMS_PER_PAGE);
  }, [chartPage, rankedChartData]);

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

  const clearFeedback = useCallback(() => {
    if (feedback) {
      setFeedback(null);
    }
  }, [feedback]);

  const showChartTooltip = useCallback((item: ChartItem, x: number, y: number) => {
    const horizontalPadding = 8;
    const verticalOffset = 18;
    const tooltipWidth = 206;
    const tooltipHeight = 62;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const nextX = Math.max(
      horizontalPadding,
      Math.min(x - tooltipWidth / 2, viewportWidth - tooltipWidth - horizontalPadding)
    );
    const nextY = Math.max(
      horizontalPadding,
      Math.min(y - tooltipHeight - verticalOffset, viewportHeight - tooltipHeight - horizontalPadding)
    );
    const arrowX = Math.max(18, Math.min(tooltipWidth - 18, x - nextX));

    setChartTooltip({ item, x: nextX, y: nextY, arrowX });
  }, []);

  const hideChartTooltip = useCallback(() => {
    setChartTooltip(null);
  }, []);

  const rememberDraft = useCallback(() => {
    setLastDraft((snapshot) => snapshot ?? structuredClone(data));
  }, [data]);

  const resetReferenceDraft = useCallback(
    (nextValue: number) => {
      setReferenceTotalDraft(formatWithThousandDots(String(nextValue)));
    },
    []
  );

  const applyReferenceTotalDraft = useCallback(() => {
    if (!isAdmin) {
      return;
    }

    const parsedValue = parseFormattedInteger(referenceTotalDraft);
    const nextReferenceTotal = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

    if (nextReferenceTotal === data.referenceTotal) {
      setIsReferenceEditing(false);
      resetReferenceDraft(data.referenceTotal);
      return;
    }

    clearFeedback();
    rememberDraft();
    setData((current) => ({
      ...current,
      referenceTotal: nextReferenceTotal,
    }));
    setIsReferenceEditing(false);
    resetReferenceDraft(nextReferenceTotal);
    setFeedback({
      type: "info",
      text: "Referensi awal diperbarui di draft lokal. Klik Simpan Perubahan untuk menyimpan ke database.",
    });
  }, [
    clearFeedback,
    data.referenceTotal,
    isAdmin,
    referenceTotalDraft,
    rememberDraft,
    resetReferenceDraft,
  ]);

  const startReferenceTotalEdit = useCallback(() => {
    if (!isAdmin) {
      return;
    }

    clearFeedback();
    setIsReferenceEditing(true);
    resetReferenceDraft(data.referenceTotal);
  }, [clearFeedback, data.referenceTotal, isAdmin, resetReferenceDraft]);

  const cancelReferenceTotalEdit = useCallback(() => {
    setIsReferenceEditing(false);
    resetReferenceDraft(data.referenceTotal);
  }, [data.referenceTotal, resetReferenceDraft]);

  const undoDraft = () => {
    if (lastDraft) {
      setData(lastDraft);
    }

    setIsReferenceEditing(false);
    resetReferenceDraft(lastDraft?.referenceTotal ?? data.referenceTotal);
    setEditingItemId(null);
    setItemEditorDraft(null);
    setItemEditorErrors({});
    setDeleteItemDialog(null);
    setLastDraft(null);
    setFeedback({ type: "info", text: "Perubahan dibatalkan." });
  };

  const openItemEditor = (item: ExpenseItem) => {
    setItemEditorMode("edit");
    setEditingItemId(item.id);
    setItemEditorDraft(createItemEditorDraft(item));
    setItemEditorErrors({});
  };

  const closeItemEditor = useCallback(() => {
    setItemEditorMode("edit");
    setEditingItemId(null);
    setItemEditorDraft(null);
    setItemEditorErrors({});
  }, []);

  const closeDeleteItemDialog = useCallback(() => {
    setDeleteItemDialog(null);
  }, []);

  const adjustItemEditorQuantity = useCallback((delta: number) => {
    setItemEditorDraft((current) => {
      if (!current) {
        return current;
      }

      const nextQuantity = Math.max(0, updateNumericValue(current.quantity, 0) + delta);
      return {
        ...current,
        quantity: String(nextQuantity),
      };
    });
    setItemEditorErrors((current) => ({ ...current, quantity: undefined }));
  }, []);

  const saveItemEditor = () => {
    if (!itemEditorDraft) {
      return;
    }

    const validationErrors = validateItemEditorDraft(itemEditorDraft);
    if (Object.keys(validationErrors).length > 0) {
      setItemEditorErrors(validationErrors);
      return;
    }

    const nextTitle = itemEditorDraft.title.trim();
    const nextCategory = itemEditorDraft.category.trim();
    const nextUnitCost = updateNumericValue(String(parseFormattedInteger(itemEditorDraft.unitCost)), 0);
    const nextQuantity = updateNumericValue(itemEditorDraft.quantity, 0);

    if (itemEditorMode === "create") {
      clearFeedback();
      rememberDraft();
      const newItem: ExpenseItem = {
        id: globalThis.crypto.randomUUID(),
        title: nextTitle,
        category: nextCategory,
        unitCost: nextUnitCost,
        quantity: nextQuantity,
        note: itemEditorDraft.note,
        paid: itemEditorDraft.paid,
      };

      setData((current) => ({
        ...current,
        items: [...current.items, newItem],
      }));
      closeItemEditor();
      setFeedback({
        type: "info",
        text: "Item baru ditambahkan di draft lokal. Klik Simpan Perubahan untuk permanen.",
      });
      return;
    }

    if (!editingItemId) {
      return;
    }

    clearFeedback();
    rememberDraft();
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              title: nextTitle,
              category: nextCategory,
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
    setItemEditorMode("create");
    setEditingItemId(null);
    setItemEditorDraft(createNewItemEditorDraft());
    setItemEditorErrors({});
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

  const openDeleteItemDialog = (item: ExpenseItem) => {
    setDeleteItemDialog({
      id: item.id,
      title: item.title,
    });
  };

  const removeItem = useCallback(() => {
    if (!deleteItemDialog) {
      return;
    }

    const targetItemId = deleteItemDialog.id;
    const targetItemTitle = deleteItemDialog.title;

    clearFeedback();
    rememberDraft();
    setData((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== targetItemId),
    }));

    if (highlightedId === targetItemId) {
      setHighlightedId(null);
    }

    if (editingItemId === targetItemId) {
      closeItemEditor();
    }

    setDeleteItemDialog(null);
    setFeedback({
      type: "info",
      text: `Item "${targetItemTitle}" dihapus di draft lokal. Klik Simpan Perubahan untuk permanen.`,
    });
  }, [
    clearFeedback,
    closeItemEditor,
    deleteItemDialog,
    editingItemId,
    highlightedId,
    rememberDraft,
  ]);

  const saveData = useCallback(() => {
    if (!isAdmin) {
      setFeedback({
        type: "error",
        text: "Akses admin diperlukan untuk menyimpan perubahan.",
      });
      return;
    }

    if (isReferenceEditing) {
      setFeedback({
        type: "error",
        text: "Klik Terapkan pada Referensi Awal terlebih dahulu sebelum menyimpan.",
      });
      return;
    }

    setFeedback({ type: "info", text: "Menyimpan perubahan..." });

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
            text: "Perubahan berhasil disimpan.",
          });
        } catch (error) {
          setFeedback({
            type: "error",
            text: resolveRuntimeErrorMessage(error, "Gagal menyimpan data ke server."),
          });
        }
      })();
    });
  }, [closeItemEditor, data, isAdmin, isReferenceEditing, startTransition]);

  useEffect(() => {
    if (isReferenceEditing) {
      return;
    }

    resetReferenceDraft(data.referenceTotal);
  }, [data.referenceTotal, isReferenceEditing, resetReferenceDraft]);

  useEffect(() => {
    setChartPage((current) => Math.min(current, chartTotalPages));
  }, [chartTotalPages]);

  useEffect(() => {
    setChartPage(1);
  }, [query, sortOption]);

  useEffect(() => {
    setTablePage((current) => Math.min(current, tableTotalPages));
  }, [tableTotalPages]);

  useEffect(() => {
    setTablePage(1);
  }, [query, sortOption, tableItemsPerPage]);

  useEffect(() => {
    if (lastDraft) {
      return;
    }

    let isEffectActive = true;
    let isSyncing = false;

    const syncFromServer = async () => {
      if (!isEffectActive || isSyncing || document.hidden) {
        return;
      }

      isSyncing = true;
      try {
        const response = await fetch("/api/expenses", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok || !isEffectActive) {
          return;
        }

        const payload = await parseJsonResponse<ExpensesApiResponse>(response);
        if (!payload || !isEffectActive) {
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
      } finally {
        isSyncing = false;
      }
    };

    const syncTimer = window.setInterval(() => {
      void syncFromServer();
    }, EXPENSE_SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void syncFromServer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isEffectActive = false;
      window.clearInterval(syncTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    if (!isAnyEditorDialogOpen) {
      return;
    }

    const bodyClassName = "item-editor-open";
    const previousOverflow = document.body.style.overflow;
    document.body.classList.add(bodyClassName);
    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isDeleteItemDialogOpen) {
          closeDeleteItemDialog();
          return;
        }

        closeItemEditor();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.classList.remove(bodyClassName);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeDeleteItemDialog, closeItemEditor, isAnyEditorDialogOpen, isDeleteItemDialogOpen]);

  useEffect(() => {
    if (isDeleteItemDialogOpen) {
      deleteItemConfirmRef.current?.focus();
      return;
    }

    if (isItemEditorOpen) {
      itemEditorTitleRef.current?.focus();
    }
  }, [isDeleteItemDialogOpen, isItemEditorOpen]);

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
          <article className="stat-card stat-fancy stat-reference-card">
            <div className="stat-reference-head">
              <p className="stat-label">Referensi Awal</p>
              {isAdmin && (
                <button
                  type="button"
                  className="stat-reference-edit-button"
                  onClick={startReferenceTotalEdit}
                  aria-label="Edit referensi awal"
                  title="Edit referensi awal"
                >
                  <MdEdit aria-hidden />
                </button>
              )}
            </div>
            {isReferenceEditing ? (
              <div className="stat-reference-edit-wrap">
                <label className="stat-reference-input-wrap">
                  <span className="stat-reference-prefix">Rp</span>
                  <input
                    className="stat-reference-input"
                    inputMode="numeric"
                    autoFocus
                    placeholder="0"
                    value={referenceTotalDraft}
                    onChange={(event) => {
                      setReferenceTotalDraft(formatWithThousandDots(event.target.value));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyReferenceTotalDraft();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelReferenceTotalEdit();
                      }
                    }}
                  />
                </label>
                <div className="stat-reference-actions">
                  <button type="button" className="button button-ghost" onClick={cancelReferenceTotalEdit}>
                    Batal
                  </button>
                  <button type="button" className="button button-primary" onClick={applyReferenceTotalDraft}>
                    Terapkan
                  </button>
                </div>
              </div>
            ) : (
              <p className="stat-value">{formatRupiah(data.referenceTotal)}</p>
            )}
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
                  className={`button button-ghost ${chartMode === "chart" ? "is-selected" : ""}`}
                  onClick={() => {
                    hideChartTooltip();
                    setChartMode("chart");
                  }}
                >
                  Chart
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
                <TrendChart
                  data={paginatedRankedChartData}
                  maxSubtotal={rankedChartData[0]?.subtotal ?? 0}
                  highlightedId={highlightedId}
                  onHighlight={setHighlightedId}
                  rankOffset={(chartPage - 1) * CHART_ITEMS_PER_PAGE}
                />
              )}
              {chartMode === "donut" && chartTooltip && (
                <div
                  className="chart-tooltip"
                  style={
                    {
                      left: chartTooltip.x,
                      top: chartTooltip.y,
                      "--chart-tooltip-arrow-x": `${chartTooltip.arrowX}px`,
                    } as CSSProperties
                  }
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

            {chartMode === "chart" && (
              <div className="chart-pagination-wrap">
                <Pagination className="chart-pagination" aria-label="Paginasi chart ranking biaya">
                  <Pagination.Content className="chart-pagination-content">
                    <Pagination.Item>
                      <Pagination.Previous
                        className="chart-pagination-control"
                        isDisabled={chartPage === 1}
                        onPress={() => setChartPage((page) => Math.max(1, page - 1))}
                      >
                        <Pagination.PreviousIcon />
                        <span>Previous</span>
                      </Pagination.Previous>
                    </Pagination.Item>
                    {Array.from({ length: chartTotalPages }, (_, index) => index + 1).map((page) => (
                      <Pagination.Item key={page}>
                        <Pagination.Link
                          className={`chart-pagination-link ${page === chartPage ? "is-active" : ""}`}
                          isActive={page === chartPage}
                          onPress={() => setChartPage(page)}
                        >
                          {page}
                        </Pagination.Link>
                      </Pagination.Item>
                    ))}
                    <Pagination.Item>
                      <Pagination.Next
                        className="chart-pagination-control"
                        isDisabled={chartPage === chartTotalPages}
                        onPress={() => setChartPage((page) => Math.min(chartTotalPages, page + 1))}
                      >
                        <span>Next</span>
                        <Pagination.NextIcon />
                      </Pagination.Next>
                    </Pagination.Item>
                  </Pagination.Content>
                </Pagination>
              </div>
            )}

            <div className="legend-grid">
              {(chartMode === "chart" ? paginatedRankedChartData : chartData).map((item) => (
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
                    ? `${resolveCategoryLabel(highlightedItem)} | ${formatRupiah(
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
              <h2 className="panel-title">Rincian Item Biaya</h2>
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
                  <th>Kategori</th>
                  {isAdmin && <th className="expense-table-actions-header" aria-label="Aksi" />}
                </tr>
              </thead>
              <tbody>
                {paginatedDisplayedItems.map((item) => {
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
                      <td data-label="Kategori">
                        <span className="cell-pill table-category-pill">{resolveCategoryLabel(item)}</span>
                      </td>
                      {isAdmin && (
                        <td className="expense-table-actions-cell" data-label="">
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
                              onClick={() => openDeleteItemDialog(item)}
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

          {displayedItems.length > 0 && (
            <div className="table-pagination-wrap">
              <p className="table-pagination-summary">
                Menampilkan {(tablePage - 1) * tableItemsPerPage + 1}-
                {Math.min(tablePage * tableItemsPerPage, displayedItems.length)} dari{" "}
                {displayedItems.length} item
              </p>
              <Pagination className="table-pagination" aria-label="Paginasi tabel rincian item biaya">
                <Pagination.Content className="table-pagination-content">
                  <Pagination.Item>
                    <Pagination.Previous
                      className="table-pagination-control"
                      isDisabled={tablePage === 1}
                      onPress={() => setTablePage((page) => Math.max(1, page - 1))}
                    >
                      <Pagination.PreviousIcon />
                      <span>Previous</span>
                    </Pagination.Previous>
                  </Pagination.Item>
                  {Array.from({ length: tableTotalPages }, (_, index) => index + 1).map((page) => (
                    <Pagination.Item key={page}>
                      <Pagination.Link
                        className={`table-pagination-link ${page === tablePage ? "is-active" : ""}`}
                        isActive={page === tablePage}
                        onPress={() => setTablePage(page)}
                      >
                        {page}
                      </Pagination.Link>
                    </Pagination.Item>
                  ))}
                  <Pagination.Item>
                    <Pagination.Next
                      className="table-pagination-control"
                      isDisabled={tablePage === tableTotalPages}
                      onPress={() => setTablePage((page) => Math.min(tableTotalPages, page + 1))}
                    >
                      <span>Next</span>
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          )}

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

      {isAdmin && deleteItemDialog && (
        <div
          className="item-editor-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteItemDialog();
            }
          }}
        >
          <section
            className="item-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-item-title"
            aria-describedby="delete-item-description"
          >
            <div className="item-editor-head">
              <h3 id="delete-item-title">Konfirmasi Hapus Item</h3>
            </div>

            <p id="delete-item-description" className="delete-item-copy">
              Apakah Anda yakin akan menghapus item ini?
            </p>
            <p className="delete-item-name">{deleteItemDialog.title}</p>

            <div className="item-editor-actions">
              <button className="button button-ghost" type="button" onClick={closeDeleteItemDialog}>
                Batalkan
              </button>
              <button
                ref={deleteItemConfirmRef}
                className="button button-danger"
                type="button"
                onClick={removeItem}
              >
                Hapus
              </button>
            </div>
          </section>
        </div>
      )}

      {isAdmin && itemEditorDraft && (
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
              <h3 id="item-editor-title">{itemEditorMode === "create" ? "Tambah Item" : "Edit Item"}</h3>
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
                Kategori
                <input
                  className="input"
                  value={itemEditorDraft.category}
                  onChange={(event) =>
                    setItemEditorDraft((current) =>
                      current ? { ...current, category: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className="field-label">
                Biaya Satuan
                <input
                  className="number-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 1.000.000"
                  value={itemEditorDraft.unitCost}
                  onChange={(event) => {
                    const formattedUnitCost = formatWithThousandDots(event.target.value);
                    setItemEditorDraft((current) =>
                      current ? { ...current, unitCost: formattedUnitCost } : current
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
                <div className="quantity-stepper">
                  <button
                    className="quantity-stepper-button"
                    type="button"
                    aria-label="Kurangi jumlah"
                    onClick={() => adjustItemEditorQuantity(-1)}
                  >
                    <MdRemove aria-hidden />
                  </button>
                  <input
                    className="quantity-stepper-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={itemEditorDraft.quantity}
                    onChange={(event) => {
                      const nextQuantity = toDigitsOnly(event.target.value);
                      setItemEditorDraft((current) =>
                        current ? { ...current, quantity: nextQuantity } : current
                      );
                      setItemEditorErrors((current) => ({ ...current, quantity: undefined }));
                    }}
                  />
                  <button
                    className="quantity-stepper-button"
                    type="button"
                    aria-label="Tambah jumlah"
                    onClick={() => adjustItemEditorQuantity(1)}
                  >
                    <MdAdd aria-hidden />
                  </button>
                </div>
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
                {itemEditorMode === "create" ? "Tambah Item" : "Simpan Item"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
