import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signed so only tokens this site issued reach Kit under its secret key.
export function signInsightToken(applicationId: string, token: string): string | null {
  const secret = process.env.STARTUPKIT_SECRET_KEY;
  return secret ? `${token}.${mac(secret, applicationId, token)}` : null;
}

export function verifyInsightToken(applicationId: string, value: string | undefined): string | null {
  const secret = process.env.STARTUPKIT_SECRET_KEY;
  const dot = value?.lastIndexOf(".") ?? -1;
  if (!secret || !value || dot <= 0) return null;

  const token = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(mac(secret, applicationId, token));
  return given.length === expected.length && timingSafeEqual(given, expected) ? token : null;
}

function mac(secret: string, applicationId: string, token: string): string {
  return createHmac("sha256", secret).update(`${applicationId}.${token}`).digest("base64url");
}
