import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  VIEW_COOKIE_NAME,
  buildAdminToken,
  getAdminCookieOptions,
  validateLoginPayload,
} from "@/lib/auth";
import { verifyUserCredential } from "@/lib/users";
import { readExpenseData } from "@/lib/expenses";

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

  const user = await verifyUserCredential(validated.username, validated.password);

  if (!user) {
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

  await readExpenseData(user.id);

  const response = NextResponse.json(
    {
      username: user.username,
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );

  response.cookies.set(
    ADMIN_COOKIE_NAME,
    buildAdminToken({
      userId: user.id,
      username: user.username,
    }),
    getAdminCookieOptions()
  );
  response.cookies.set(VIEW_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });
  return response;
}
