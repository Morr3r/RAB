import { ADMIN_COOKIE_NAME, isValidAdminToken } from "@/lib/auth";
import { readExpenseData, type ExpenseData, writeExpenseData } from "@/lib/expenses";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const data = await readExpenseData();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminToken(token)) {
    return NextResponse.json(
      { message: "Unauthorized" },
      {
        status: 401,
      }
    );
  }

  let payload: Partial<ExpenseData>;

  try {
    payload = (await request.json()) as Partial<ExpenseData>;
  } catch {
    return NextResponse.json(
      {
        message: "Payload tidak valid",
      },
      {
        status: 400,
      }
    );
  }

  const updated = await writeExpenseData(payload);
  return NextResponse.json(updated);
}
