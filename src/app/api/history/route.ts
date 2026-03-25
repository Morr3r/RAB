import { NextResponse } from "next/server";
import { readExpenseHistory } from "@/lib/expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback;
}

function parseHistoryLimit(requestUrl: string) {
  const url = new URL(requestUrl);
  const queryLimit = url.searchParams.get("limit");
  const parsedLimit = Number(queryLimit);

  if (!Number.isFinite(parsedLimit)) {
    return 40;
  }

  return Math.max(1, Math.min(120, Math.floor(parsedLimit)));
}

export async function GET(request: Request) {
  try {
    const data = await readExpenseHistory(parseHistoryLimit(request.url));

    return NextResponse.json(
      { data },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Gagal mengambil history perubahan."),
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
