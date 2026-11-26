import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;
export const SESSION_COOKIE_NAME = "admin_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  const [algorithm, salt, hashHex, ...extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !hashHex ||
    extra.length > 0 ||
    !/^[0-9a-f]+$/i.test(salt) ||
    !/^[0-9a-f]+$/i.test(hashHex) ||
    hashHex.length % 2 !== 0
  ) {
    return false;
  }

  const expectedHash = Buffer.from(hashHex, "hex");
  const actualHash = (await scrypt(password, salt, expectedHash.length)) as Buffer;
  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET must be set to sign or verify session tokens");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createSessionToken(
  subject: string,
  expiresAt: Date
): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: subject, exp: Math.floor(expiresAt.getTime() / 1000) })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): {
  subject: string;
  expiresAt: Date;
} | null {
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length > 0) return null;

  try {
    const expectedSignature = Buffer.from(sign(payload), "base64url");
    const actualSignature = Buffer.from(signature, "base64url");
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null;
    }

    const parsed: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("sub" in parsed) ||
      typeof parsed.sub !== "string" ||
      !parsed.sub ||
      !("exp" in parsed) ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { subject: parsed.sub, expiresAt: new Date(parsed.exp * 1000) };
  } catch {
    return null;
  }
}
