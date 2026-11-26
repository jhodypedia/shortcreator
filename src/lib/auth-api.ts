import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";

export { SESSION_COOKIE_NAME };
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;
export const WORKER_SECRET_HEADER = "x-worker-secret";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const attemptsByIp = new Map<string, { failures: number[]; blockedUntil: number }>();

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function isLoginBlocked(ip: string, now = Date.now()): boolean {
  const record = attemptsByIp.get(ip);
  if (!record) return false;
  if (record.blockedUntil > now) return true;
  if (record.blockedUntil && record.blockedUntil <= now) {
    attemptsByIp.delete(ip);
    return false;
  }
  record.failures = record.failures.filter((timestamp) => now - timestamp < LOGIN_WINDOW_MS);
  if (record.failures.length === 0) attemptsByIp.delete(ip);
  return false;
}

export function recordFailedLogin(ip: string, now = Date.now()): void {
  const record = attemptsByIp.get(ip) ?? { failures: [], blockedUntil: 0 };
  record.failures = record.failures.filter((timestamp) => now - timestamp < LOGIN_WINDOW_MS);
  record.failures.push(now);
  if (record.failures.length >= MAX_LOGIN_ATTEMPTS) {
    record.blockedUntil = now + LOGIN_WINDOW_MS;
    record.failures = [];
  }
  attemptsByIp.set(ip, record);
}

export function clearFailedLogins(ip: string): void {
  attemptsByIp.delete(ip);
}

export function blockedLoginResponse(): NextResponse {
  return NextResponse.json(
    { error: "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit." },
    { status: 429 }
  );
}

export function setSessionCookie(response: NextResponse, adminId: string): void {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSessionToken(adminId, expiresAt),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
      expires: expiresAt,
    }
  );
}

export function isAuthorizedWorkerRequest(request: Request): boolean {
  const secret = process.env.WORKER_SECRET;
  return Boolean(
    secret &&
      request.headers.get(WORKER_SECRET_HEADER) &&
      request.headers.get(WORKER_SECRET_HEADER) === secret
  );
}

export async function getAdminSession(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) return null;

  const token = cookie.slice(SESSION_COOKIE_NAME.length + 1);
  const session = verifySessionToken(decodeURIComponent(token));
  if (!session) return null;

  const adminHash = await db.appSetting.findUnique({
    where: { key: "admin.passwordHash" },
    select: { value: true },
  });
  return adminHash ? session.subject : null;
}
