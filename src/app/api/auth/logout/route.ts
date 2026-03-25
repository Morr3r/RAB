import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, VIEW_COOKIE_NAME, getAdminCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function POST() {
  const response = NextResponse.json(
    {
      success: true,
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );

  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set(VIEW_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });

  return response;
}
