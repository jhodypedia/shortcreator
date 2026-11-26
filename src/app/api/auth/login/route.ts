import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import {
  blockedLoginResponse,
  clearFailedLogins,
  getClientIp,
  isLoginBlocked,
  recordFailedLogin,
  setSessionCookie,
} from "@/lib/auth-api";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isLoginBlocked(ip)) return blockedLoginResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  if (
    typeof body !== "object" || body === null || !("password" in body) ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json({ error: "Kata sandi wajib diisi." }, { status: 400 });
  }

  try {
    const admin = await db.appSetting.findUnique({
      where: { key: "admin.passwordHash" },
      select: { value: true },
    });
    if (!admin || !(await verifyPassword(body.password, admin.value))) {
      recordFailedLogin(ip);
      if (isLoginBlocked(ip)) return blockedLoginResponse();
      return NextResponse.json({ error: "Kata sandi salah." }, { status: 401 });
    }

    clearFailedLogins(ip);
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, "admin");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Proses masuk gagal. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
