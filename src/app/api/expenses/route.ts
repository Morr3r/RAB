import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminUsername, isValidAdminToken } from "@/lib/auth";
import { readExpenseData, type ExpenseData, writeExpenseData } from "@/lib/expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type ExpenseUpdatePayload = Partial<ExpenseData> & {
  meta?: {
    page?: string;
    pageLabel?: string;
  };
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback;
}

export async function GET() {
  try {
    const data = await readExpenseData();

    return NextResponse.json(
      { data },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Gagal mengambil data dari database."),
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminToken(adminToken)) {
    return NextResponse.json(
      {
        error: "Sesi admin tidak valid. Silakan login ulang.",
      },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  let payload: ExpenseUpdatePayload;

  try {
    const parsed = await request.json();
    payload = typeof parsed === "object" && parsed !== null ? (parsed as ExpenseUpdatePayload) : {};
  } catch {
    return NextResponse.json(
      {
        error: "Payload JSON tidak valid.",
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  try {
    const { meta, ...expensePayload } = payload;
    const data = await writeExpenseData(expensePayload, {
      actor: getAdminUsername(),
      page: meta?.page,
      pageLabel: meta?.pageLabel,
    });

    return NextResponse.json(
      { data },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Gagal menyimpan data ke database."),
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
