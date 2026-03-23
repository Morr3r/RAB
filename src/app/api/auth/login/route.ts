import {
  ADMIN_COOKIE_NAME,
  buildAdminToken,
  getAdminUsername,
  getAdminCookieOptions,
  validateLoginPayload,
  verifyCredential,
} from "@/lib/auth";
import { NextResponse } from "next/server";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { message: "Payload login tidak valid." },
      {
        status: 400,
      }
    );
  }

  const validationResult = validateLoginPayload(body);

  if (!validationResult.isValid) {
    return NextResponse.json(
      {
        message: "Data login belum valid.",
        fieldErrors: validationResult.fieldErrors,
      },
      {
        status: 400,
      }
    );
  }

  if (!verifyCredential(validationResult.username, validationResult.password)) {
    return NextResponse.json(
      { message: "Username atau password salah.", fieldErrors: {} },
      {
        status: 401,
      }
    );
  }

  const response = NextResponse.json({
    message: "Login berhasil.",
    user: { username: getAdminUsername() },
  });
  response.cookies.set(ADMIN_COOKIE_NAME, buildAdminToken(), getAdminCookieOptions());
  return response;
}
