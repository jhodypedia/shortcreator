import { NextResponse } from "next/server";
import { gflowStatus, startGflowLogin } from "@/lib/gflow";

export const runtime = "nodejs";

export async function POST() {
  try {
    const status = await gflowStatus();
    if (status.authenticated) return NextResponse.json({ ok: true, authenticated: true, message: "Sesi Google Flow sudah aktif." });
    const login = await startGflowLogin();
    return NextResponse.json({ ok: true, ...login, message: login.alreadyRunning ? "Login Flow masih berjalan pada desktop server." : "Login Flow dibuka pada desktop server." }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memulai login Flow" }, { status: 503 });
  }
}
