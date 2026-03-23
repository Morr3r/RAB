import ExpenseDashboard from "@/components/expense-dashboard";
import { ADMIN_COOKIE_NAME, getAdminUsername, isValidAdminToken } from "@/lib/auth";
import { readExpenseData } from "@/lib/expenses";
import { cookies } from "next/headers";

export default async function Home() {
  const [expenseData, cookieStore] = await Promise.all([readExpenseData(), cookies()]);
  const isAdmin = isValidAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  return (
    <ExpenseDashboard
      initialData={expenseData}
      initialIsAdmin={isAdmin}
      initialAdminUsername={isAdmin ? getAdminUsername() : null}
    />
  );
}
