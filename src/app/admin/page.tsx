import { cookies } from "next/headers";
import AdminAccessPage from "@/components/admin-access-page";
import { ADMIN_COOKIE_NAME, VIEW_COOKIE_NAME, resolveAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = resolveAuthSession({
    adminToken: cookieStore.get(ADMIN_COOKIE_NAME)?.value,
    viewToken: cookieStore.get(VIEW_COOKIE_NAME)?.value,
  });

  return (
    <AdminAccessPage
      initialAdminUsername={session.isAdmin ? session.username : null}
    />
  );
}
