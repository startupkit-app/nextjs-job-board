import assert from "node:assert/strict";
import test from "node:test";
import { clientIp } from "../lib/client-ip.ts";

test("the client is the first forwarded hop, else the real-ip header", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
});

test("an address that does not parse names no client", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "unknown" })), undefined);
  assert.equal(clientIp(new Headers()), undefined);
});
