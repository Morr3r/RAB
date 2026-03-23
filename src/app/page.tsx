import ExpenseDashboard from "@/components/expense-dashboard";
import type { ExpenseData } from "@/lib/expenses";
import initialDataJson from "../../data/expenses.json";

const initialData = initialDataJson as ExpenseData;

export default function Home() {
  return (
    <ExpenseDashboard
      initialData={initialData}
      initialIsAdmin={false}
      initialAdminUsername={null}
    />
  );
}
