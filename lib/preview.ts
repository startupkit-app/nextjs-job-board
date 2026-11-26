import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const previewKeyConfigured = process.env.STARTUPKIT_SECRET_KEY?.startsWith("dp_") ?? false;
export const previewMode = previewKeyConfigured || Boolean(process.env.STARTUPKIT_PREVIEW_PASSWORD);

const SECURE_COOKIE = process.env.NODE_ENV === "production";
const COOKIE_NAME = SECURE_COOKIE ? "__Host-kit-careers-preview" : "kit-careers-preview";
const SESSION_SECONDS = 8 * 60 * 60;

function previewPassword(): string | undefined {
  const password = process.env.STARTUPKIT_PREVIEW_PASSWORD;
  return previewKeyConfigured && password && password.length >= 24 && password.length <= 256 ? password : undefined;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function signature(expires: string, password: string) {
  return createHmac("sha256", password).update(`kit-careers-preview-v1:${expires}`).digest("base64url");
}

export async function hasPreviewAccess(): Promise<boolean> {
  const store = await cookies();
  const password = previewPassword();
  if (!password) return false;

  const session = store.get(COOKIE_NAME)?.value ?? "";
  const [expires, signed, ...extra] = session.split(".");
  if (!expires || !signed || extra.length || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) return false;

  return timingSafeEqual(digest(signed), digest(signature(expires, password)));
}

export async function requirePreviewAccess() {
  if (previewMode && !(await hasPreviewAccess())) redirect("/preview-access");
}

export async function signInToPreview(supplied: FormDataEntryValue | null): Promise<boolean> {
  const password = previewPassword();
  if (!previewMode || !password || typeof supplied !== "string" || supplied.length > 256 ||
      !timingSafeEqual(digest(supplied), digest(password))) return false;

  const expires = (Date.now() + SESSION_SECONDS * 1000).toString();
  (await cookies()).set(COOKIE_NAME, `${expires}.${signature(expires, password)}`, {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return true;
}
