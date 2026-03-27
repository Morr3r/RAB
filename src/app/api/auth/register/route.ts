import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  VIEW_COOKIE_NAME,
  buildAdminToken,
  getAdminCookieOptions,
  validateRegisterPayload,
} from "@/lib/auth";
import { readExpenseData } from "@/lib/expenses";
import { validateRegistrationProfile } from "@/lib/registration-validation";
import { DuplicateEmailError, DuplicateUsernameError, registerUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type RegisterBody = {
  username?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  birthPlace?: string;
  birthDate?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
};

type RegisterFieldErrors = {
  username?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  birthPlace?: string;
  birthDate?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
};

export async function POST(request: Request) {
  let payload: RegisterBody = {};

  try {
    const parsed = await request.json();
    if (typeof parsed === "object" && parsed !== null) {
      payload = parsed as RegisterBody;
    }
  } catch {
    payload = {};
  }

  const validated = validateRegisterPayload(payload);
  const profileValidation = validateRegistrationProfile(payload);
  const fieldErrors: RegisterFieldErrors = {
    ...validated.fieldErrors,
    ...profileValidation.fieldErrors,
  };
  const confirmPassword =
    typeof payload.confirmPassword === "string" ? payload.confirmPassword.trim() : "";

  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Konfirmasi password wajib diisi.";
  } else if (validated.isValid && confirmPassword !== validated.password) {
    fieldErrors.confirmPassword = "Konfirmasi password tidak sama.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      {
        error: "Data registrasi tidak valid.",
        fieldErrors,
      },
      {
        status: 422,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  try {
    const user = await registerUser({
      username: validated.username,
      password: validated.password,
      firstName: profileValidation.normalized.firstName,
      lastName: profileValidation.normalized.lastName,
      email: profileValidation.normalized.email,
      birthPlace: profileValidation.normalized.birthPlace,
      birthDate: profileValidation.normalized.birthDate,
      phoneCountryCode: profileValidation.normalized.phoneCountryCode,
      phoneNumber: profileValidation.normalized.phoneNumber,
    });
    await readExpenseData(user.id);

    const response = NextResponse.json(
      {
        username: user.username,
        message: "Registrasi berhasil.",
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
  } catch (error) {
    if (error instanceof DuplicateUsernameError) {
      return NextResponse.json(
        {
          error: "Username sudah terdaftar. Gunakan username lain.",
          fieldErrors: {
            username: "Username sudah digunakan.",
          },
        },
        {
          status: 409,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    if (error instanceof DuplicateEmailError) {
      return NextResponse.json(
        {
          error: "Email sudah terdaftar. Gunakan email lain.",
          fieldErrors: {
            email: "Email sudah digunakan.",
          },
        },
        {
          status: 409,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(
      {
        error: "Terjadi kesalahan saat membuat akun.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
