import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth-api";

export async function GET(request: Request) {
  try {
    const [admin, session] = await Promise.all([
      db.appSetting.findUnique({
        where: { key: "admin.passwordHash" },
        select: { key: true },
      }),
      getAdminSession(request),
    ]);
    return NextResponse.json({ isSetup: Boolean(admin), isAuthenticated: Boolean(session) });
  } catch {
    return NextResponse.json(
      { error: "Status autentikasi tidak dapat diperiksa." },
      { status: 500 }
    );
  }
}
