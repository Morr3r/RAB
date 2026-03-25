import { cookies } from "next/headers";
import ExpenseDashboard from "@/components/expense-dashboard";
import HomeLoadingGate from "@/components/home-loading-gate";
import { ADMIN_COOKIE_NAME, isValidAdminToken } from "@/lib/auth";
import { readExpenseData } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await readExpenseData();
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = isValidAdminToken(adminToken);

  return (
    <HomeLoadingGate>
      <ExpenseDashboard
        initialData={data}
        initialIsAdmin={isAdmin}
      />
    </HomeLoadingGate>
  );
}
