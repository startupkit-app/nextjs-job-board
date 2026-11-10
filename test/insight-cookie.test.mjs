import assert from "node:assert/strict";
import test from "node:test";
import { signInsightToken, verifyInsightToken } from "../lib/insight-cookie.ts";

process.env.STARTUPKIT_SECRET_KEY = "sk_cookie_test";

test("a signed token verifies for its own application", () => {
  assert.equal(verifyInsightToken("app_a", signInsightToken("app_a", "ins_123")), "ins_123");
});

test("a tampered token is rejected", () => {
  const [, mac] = signInsightToken("app_a", "ins_123").split(".");
  assert.equal(verifyInsightToken("app_a", `ins_124.${mac}`), null);
});

test("a tampered MAC is rejected", () => {
  const signed = signInsightToken("app_a", "ins_123");
  const flipped = signed.slice(0, -1) + (signed.endsWith("A") ? "B" : "A");
  assert.equal(verifyInsightToken("app_a", flipped), null);
  assert.equal(verifyInsightToken("app_a", signed.slice(0, -1)), null);
});

test("a cookie signed for another application is rejected", () => {
  assert.equal(verifyInsightToken("app_b", signInsightToken("app_a", "ins_123")), null);
});

test("a missing or unsigned cookie is rejected", () => {
  assert.equal(verifyInsightToken("app_a", undefined), null);
  assert.equal(verifyInsightToken("app_a", "ins_123"), null);
});
