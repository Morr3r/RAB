import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  VIEW_COOKIE_NAME,
  getAdminUsername,
  isValidAdminToken,
  isValidViewToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const viewToken = cookieStore.get(VIEW_COOKIE_NAME)?.value;
  const isAdmin = isValidAdminToken(adminToken);
  const isViewOnly = !isAdmin && isValidViewToken(viewToken);
  const isAuthenticated = isAdmin || isViewOnly;

  return NextResponse.json(
    {
      isAdmin,
      isViewOnly,
      isAuthenticated,
      username: isAuthenticated ? getAdminUsername() : null,
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );
}
