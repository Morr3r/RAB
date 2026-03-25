import { cookies } from "next/headers";
import AdminAccessPage from "@/components/admin-access-page";
import { ADMIN_COOKIE_NAME, getAdminUsername, isValidAdminToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = isValidAdminToken(adminToken);

  return (
    <AdminAccessPage
      initialAdminUsername={isAdmin ? getAdminUsername() : null}
    />
  );
}
