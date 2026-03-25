import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  VIEW_COOKIE_NAME,
  buildViewToken,
  getAdminCookieOptions,
  validateLoginPayload,
  verifyCredential,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type VerifyBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  let payload: VerifyBody = {};

  try {
    const parsed = await request.json();
    if (typeof parsed === "object" && parsed !== null) {
      payload = parsed as VerifyBody;
    }
  } catch {
    payload = {};
  }

  const validated = validateLoginPayload(payload);

  if (!validated.isValid) {
    return NextResponse.json(
      {
        error: "Data login tidak valid.",
        fieldErrors: validated.fieldErrors,
      },
      {
        status: 422,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  if (!verifyCredential(validated.username, validated.password)) {
    return NextResponse.json(
      {
        error: "Username atau password tidak valid.",
      },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  const response = NextResponse.json(
    {
      success: true,
      mode: "view",
      username: validated.username,
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );

  response.cookies.set(VIEW_COOKIE_NAME, buildViewToken(), getAdminCookieOptions());
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });

  return response;
}
