import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, VIEW_COOKIE_NAME, resolveAuthSession } from "@/lib/auth";
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
  const cookieStore = await cookies();
  const session = resolveAuthSession({
    adminToken: cookieStore.get(ADMIN_COOKIE_NAME)?.value,
    viewToken: cookieStore.get(VIEW_COOKIE_NAME)?.value,
  });

  if (!session.isAuthenticated || session.userId === null) {
    redirect("/");
  }

  const history = await readExpenseHistory(session.userId, 80);
  const lastGlobalUpdate = history.length > 0 ? formatDate(history[0].changedAt) : "-";

  return (
    <div className="page-shell">
      <main className="content-wrap content-wrap-history">
        <section className="hero-card hero-future history-hero">
          <div className="hero-main">
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
          <HistoryTimeline entries={history} />
        </section>
      </main>
    </div>
  );
}
