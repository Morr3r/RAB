import Link from "next/link";
import { readExpenseHistory } from "@/lib/expenses";

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

          <div className="history-hero-cta">
            <p className="history-hero-cta-title">Kembali ke workspace utama</p>
            <p className="history-hero-cta-copy">
              Lakukan perubahan data dari dashboard, lalu pantau jejak perubahan di halaman ini.
            </p>
            <Link href="/" className="button button-primary">
              Buka Dashboard
            </Link>
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

          <article className="panel history-log-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Timeline Aktivitas</h2>
                <p className="panel-subtitle">
                  Urutan perubahan terbaru, termasuk item apa saja yang diubah.
                </p>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="history-empty">Belum ada aktivitas perubahan.</p>
            ) : (
              <div className="history-log-list">
                {history.map((entry) => (
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
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
