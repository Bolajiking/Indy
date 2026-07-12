import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { RedisRateLimitStore } from "../../src/api/rate-limit-store.js";

const redisUrl = process.env.TEST_REDIS_URL;

describe.skipIf(!redisUrl)("Redis rate-limit store integration", () => {
  const namespace = `indy:test:rate-limit:${randomUUID()}`;
  const clients: Redis[] = [];
  let firstClient: Redis;
  let secondClient: Redis;
  let firstStore: RedisRateLimitStore;
  let secondStore: RedisRateLimitStore;

  beforeAll(async () => {
    firstClient = new Redis(redisUrl!);
    secondClient = new Redis(redisUrl!);
    clients.push(firstClient, secondClient);
    firstStore = new RedisRateLimitStore(redisUrl!, firstClient);
    secondStore = new RedisRateLimitStore(redisUrl!, secondClient);
    await Promise.all([firstStore.ready(), secondStore.ready()]);
  });

  afterEach(async () => {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await firstClient.scan(
        cursor,
        "MATCH",
        `${namespace}:*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) await firstClient.del(...keys);
    } while (cursor !== "0");
  });

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.quit()));
  });

  it("increments atomically under concurrency and always creates a TTL", async () => {
    const key = `${namespace}:concurrent`;
    const results = await Promise.all(
      Array.from({ length: 100 }, () => firstStore.increment(key, 2_000)),
    );

    expect(results.map(({ count }) => count).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(await firstClient.pttl(key)).toBeGreaterThan(0);
  });

  it("does not reset the initial window TTL on later increments", async () => {
    const key = `${namespace}:fixed-window`;
    await firstStore.increment(key, 2_000);
    const initialTtl = await firstClient.pttl(key);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await secondStore.increment(key, 2_000);
    const laterTtl = await firstClient.pttl(key);

    expect(laterTtl).toBeGreaterThan(0);
    expect(laterTtl).toBeLessThan(initialTtl - 50);
  });

  it("expires and recovers with a fresh count without immortal keys", async () => {
    const key = `${namespace}:expiry`;
    const first = await firstStore.increment(key, 100);
    expect(first.count).toBe(1);
    expect(await firstClient.pttl(key)).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await firstClient.exists(key)).toBe(0);
    const recovered = await secondStore.increment(key, 100);
    expect(recovered.count).toBe(1);
    expect(await firstClient.pttl(key)).toBeGreaterThan(0);
  });

  it("repairs a pre-existing counter that has no expiry", async () => {
    const key = `${namespace}:missing-ttl`;
    await firstClient.set(key, "7");
    expect(await firstClient.pttl(key)).toBe(-1);

    const result = await secondStore.increment(key, 1_000);

    expect(result.count).toBe(8);
    expect(await firstClient.pttl(key)).toBeGreaterThan(0);
  });

  it("shares counts across independent clients and store instances", async () => {
    const key = `${namespace}:shared`;

    expect((await firstStore.increment(key, 1_000)).count).toBe(1);
    expect((await secondStore.increment(key, 1_000)).count).toBe(2);
  });
});
