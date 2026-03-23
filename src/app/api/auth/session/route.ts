import { ADMIN_COOKIE_NAME, getAdminUsername, isValidAdminToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = isValidAdminToken(token);

  return NextResponse.json({
    isAdmin,
    user: isAdmin ? { username: getAdminUsername() } : null,
  });
}
