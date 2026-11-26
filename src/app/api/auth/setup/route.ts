import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-api";
import { db } from "@/lib/db";

export async function POST(request: Request) {
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
  if (body.password.length < 12) {
    return NextResponse.json(
      { error: "Kata sandi harus terdiri dari minimal 12 karakter." },
      { status: 400 }
    );
  }

  try {
    const current = await db.appSetting.findUnique({
      where: { key: "admin.passwordHash" },
      select: { key: true },
    });
    if (current) {
      return NextResponse.json(
        { error: "Admin sudah dibuat. Pengaturan awal hanya dapat dilakukan sekali." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(body.password);
    try {
      await db.appSetting.create({
        data: { key: "admin.passwordHash", value: passwordHash },
      });
    } catch (error) {
      if (
        error && typeof error === "object" && "code" in error &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Admin sudah dibuat. Pengaturan awal hanya dapat dilakukan sekali." },
          { status: 409 }
        );
      }
      throw error;
    }

    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, "admin");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Pengaturan admin gagal disimpan." },
      { status: 500 }
    );
  }
}
