import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminUsername, isValidAdminToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = isValidAdminToken(adminToken);

  return NextResponse.json(
    {
      isAdmin,
      username: isAdmin ? getAdminUsername() : null,
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );
}
