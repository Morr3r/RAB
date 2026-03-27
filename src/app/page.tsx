import { cookies } from "next/headers";
import ExpenseDashboard from "@/components/expense-dashboard";
import HomeLoadingGate from "@/components/home-loading-gate";
import { ADMIN_COOKIE_NAME, VIEW_COOKIE_NAME, resolveAuthSession } from "@/lib/auth";
import { createEmptyExpenseData, readExpenseData } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const session = resolveAuthSession({
    adminToken: cookieStore.get(ADMIN_COOKIE_NAME)?.value,
    viewToken: cookieStore.get(VIEW_COOKIE_NAME)?.value,
  });
  const data =
    session.isAuthenticated && session.userId !== null
      ? await readExpenseData(session.userId)
      : createEmptyExpenseData();

  return (
    <HomeLoadingGate>
      <ExpenseDashboard
        initialData={data}
        initialIsAdmin={session.isAdmin}
      />
    </HomeLoadingGate>
  );
}
