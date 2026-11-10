import { isIP } from "node:net";

// Unparseable means undefined, since Kit rejects a malformed consent IP. Vercel overwrites
// both headers; a proxy that appends to a client-sent x-forwarded-for makes this spoofable.
export function clientIp(headerList: Headers): string | undefined {
  const forwardedFor = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwardedFor || headerList.get("x-real-ip")?.trim() || "";
  return isIP(candidate) ? candidate : undefined;
}
