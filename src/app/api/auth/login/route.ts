import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  buildAdminToken,
  getAdminCookieOptions,
  validateLoginPayload,
  verifyCredential,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  let payload: LoginBody = {};

  try {
    const parsed = await request.json();
    if (typeof parsed === "object" && parsed !== null) {
      payload = parsed as LoginBody;
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
      username: validated.username,
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );

  response.cookies.set(ADMIN_COOKIE_NAME, buildAdminToken(), getAdminCookieOptions());
  return response;
}
