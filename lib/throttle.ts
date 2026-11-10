/** In-memory per instance, so serverless instances each count alone: an abuse brake, not a quota. */
export function createThrottle({
  limit,
  windowMs,
  maxClients = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxClients?: number;
}): (client: string, now?: number) => boolean {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function makeRoom(now: number) {
    for (const [client, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(client);
    }
    for (const client of buckets.keys()) {
      if (buckets.size < maxClients) break;
      buckets.delete(client);
    }
  }

  return function take(client, now = Date.now()) {
    let bucket = buckets.get(client);
    if (!bucket || bucket.resetAt <= now) {
      buckets.delete(client);
      if (buckets.size >= maxClients) makeRoom(now);
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(client, bucket);
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  };
}
