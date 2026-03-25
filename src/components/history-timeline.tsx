"use client";

import { useMemo, useState } from "react";

type HistoryTimelineEntry = {
  id: number;
  changedAt: string;
  pageLabel: string;
  actor: string;
  summary: string;
  details: string[];
};

type HistoryTimelineProps = {
  entries: HistoryTimelineEntry[];
};

const TIMELINE_PAGE_SIZE = 10;

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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M14.75 6.5L9.25 12L14.75 17.5" : "M9.25 6.5L14.75 12L9.25 17.5"}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HistoryTimeline({ entries }: HistoryTimelineProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(entries.length / TIMELINE_PAGE_SIZE));
  const hasPagination = entries.length > TIMELINE_PAGE_SIZE;
  const normalizedPage = Math.min(page, totalPages);

  const pagedEntries = useMemo(() => {
    const startIndex = (normalizedPage - 1) * TIMELINE_PAGE_SIZE;
    return entries.slice(startIndex, startIndex + TIMELINE_PAGE_SIZE);
  }, [entries, normalizedPage]);

  return (
    <article className="panel history-log-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Timeline Aktivitas</h2>
          <p className="panel-subtitle">Urutan perubahan terbaru, termasuk item apa saja yang diubah.</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="history-empty">Belum ada aktivitas perubahan.</p>
      ) : (
        <>
          <div className="history-log-list">
            {pagedEntries.map((entry) => (
              <article key={entry.id} className="history-log-item">
                <header className="history-log-head">
                  <div className="history-log-head-main">
                    <p className="history-log-page">{entry.pageLabel}</p>
                    <h3>{entry.summary}</h3>
                  </div>
                  <div className="history-log-meta">
                    <p>{formatDate(entry.changedAt)}</p>
                    <p>oleh {entry.actor}</p>
                  </div>
                </header>

                {entry.details.length > 0 && (
                  <ul className="history-log-details">
                    {entry.details.map((detail, index) => (
                      <li key={`${entry.id}-${index}`}>{detail}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          {hasPagination && (
            <nav className="history-pagination" aria-label="Pagination timeline history">
              <button
                className="history-pagination-button"
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={normalizedPage <= 1}
                aria-label="Halaman sebelumnya"
              >
                <ChevronIcon direction="left" />
              </button>

              <div className="history-pagination-meta" aria-live="polite">
                <span className="history-pagination-current">{normalizedPage}</span>
                <span className="history-pagination-text">dari {totalPages}</span>
              </div>

              <button
                className="history-pagination-button"
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={normalizedPage >= totalPages}
                aria-label="Halaman berikutnya"
              >
                <ChevronIcon direction="right" />
              </button>
            </nav>
          )}
        </>
      )}
    </article>
  );
}
