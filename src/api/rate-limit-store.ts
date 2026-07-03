import { Redis } from "ioredis";

export interface RateLimitStore {
  increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAt: number }>;
  close?(): Promise<void>;
}

export interface RateLimitRuntimeConfig {
  nodeEnv: "development" | "production" | "test";
  distributed: boolean;
  redisUrl: string;
}

export function createConfiguredRateLimitStore(
  config: RateLimitRuntimeConfig,
  createRedisStore: (redisUrl: string) => RateLimitStore = (redisUrl) =>
    new RedisRateLimitStore(redisUrl),
): RateLimitStore {
  if (config.nodeEnv === "production" && !config.distributed) {
    throw new Error("Distributed rate limiting must be enabled in production");
  }
  if (config.distributed) {
    if (!config.redisUrl.trim()) {
      throw new Error("REDIS_URL is required for distributed rate limiting");
    }
    return createRedisStore(config.redisUrl);
  }
  return new InMemoryRateLimitStore();
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

export interface InMemoryRateLimitStoreOptions {
  now?: () => number;
  maxEntries?: number;
}

/** Deterministic, bounded adapter for tests and local development. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, MemoryBucket>();
  private readonly now: () => number;
  private readonly maxEntries: number;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  async increment(key: string, windowMs: number) {
    const now = this.now();
    this.removeExpired(now);
    const existing = this.buckets.get(key);

    if (existing && existing.resetAt > now) {
      existing.count += 1;
      return { count: existing.count, resetAt: existing.resetAt };
    }

    if (this.buckets.size >= this.maxEntries) {
      const oldestKey = this.buckets.keys().next().value as string | undefined;
      if (oldestKey) this.buckets.delete(oldestKey);
    }

    const bucket = { count: 1, resetAt: now + windowMs };
    this.buckets.set(key, bucket);
    return bucket;
  }

  private removeExpired(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

const INCREMENT_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

/** Atomic fixed-window adapter shared by all production API instances. */
export class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;

  constructor(redisUrl: string, redis?: Redis) {
    this.redis =
      redis ??
      new Redis(redisUrl, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
  }

  async increment(key: string, windowMs: number) {
    const result = (await this.redis.eval(
      INCREMENT_WINDOW_SCRIPT,
      1,
      key,
      windowMs,
    )) as [number, number];
    const [count, ttl] = result.map(Number) as [number, number];
    return { count, resetAt: Date.now() + Math.max(0, ttl) };
  }

  async close() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
