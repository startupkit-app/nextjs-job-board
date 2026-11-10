import assert from "node:assert/strict";
import test from "node:test";
import { createThrottle } from "../lib/throttle.ts";

test("a client gets its limit per window, then waits for the next window", () => {
  const take = createThrottle({ limit: 2, windowMs: 1_000 });

  assert.equal(take("203.0.113.7", 0), true);
  assert.equal(take("203.0.113.7", 10), true);
  assert.equal(take("203.0.113.7", 999), false);
  assert.equal(take("203.0.113.7", 1_000), true);
});

test("clients are throttled independently", () => {
  const take = createThrottle({ limit: 1, windowMs: 1_000 });

  assert.equal(take("203.0.113.7", 0), true);
  assert.equal(take("203.0.113.7", 0), false);
  assert.equal(take("198.51.100.2", 0), true);
});

test("memory stays bounded by dropping the oldest window", () => {
  const take = createThrottle({ limit: 1, windowMs: 1_000, maxClients: 2 });
  take("a", 0);
  take("b", 1);
  take("c", 2);

  assert.equal(take("c", 3), false);
  assert.equal(take("a", 3), true);
});
