import { readExpenseHistory } from "@/lib/expenses";
import HistoryTimeline from "@/components/history-timeline";

export const dynamic = "force-dynamic";

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

export default async function HistoryPage() {
  const history = await readExpenseHistory(80);
  const latestPerPage = new Map<string, (typeof history)[number]>();

  for (const entry of history) {
    if (!latestPerPage.has(entry.page)) {
      latestPerPage.set(entry.page, entry);
    }
  }

  const latestPerPageList = Array.from(latestPerPage.values());
  const lastGlobalUpdate = history.length > 0 ? formatDate(history[0].changedAt) : "-";

  return (
    <div className="page-shell">
      <main className="content-wrap content-wrap-history">
        <section className="hero-card hero-future history-hero">
          <div className="hero-main">
            <p className="eyebrow">Audit Timeline</p>
            <h1>History Perubahan Terakhir</h1>
            <p className="hero-copy">
              Setiap simpan perubahan akan tercatat otomatis lengkap dengan detail item yang diubah.
            </p>
            <div className="hero-chip-wrap">
              <p className="meta-chip">Update terakhir: {lastGlobalUpdate}</p>
              <p className="meta-chip">{history.length} aktivitas tercatat</p>
            </div>
          </div>
        </section>

        <section className="history-page-grid">
          <article className="panel history-summary-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Update Terakhir per Page</h2>
                <p className="panel-subtitle">
                  Ringkasan page yang paling baru mengalami perubahan.
                </p>
              </div>
            </div>

            {latestPerPageList.length === 0 ? (
              <p className="history-empty">Belum ada history. Simpan perubahan dari dashboard dulu.</p>
            ) : (
              <div className="history-page-list">
                {latestPerPageList.map((entry) => (
                  <article key={`summary-${entry.id}`} className="history-page-card">
                    <p className="history-page-card-title">{entry.pageLabel}</p>
                    <p className="history-page-card-time">{formatDate(entry.changedAt)}</p>
                    <p className="history-page-card-summary">{entry.summary}</p>
                  </article>
                ))}
              </div>
            )}
          </article>

          <HistoryTimeline entries={history} />
        </section>
      </main>
    </div>
  );
}
