import { Redis } from "ioredis";

export interface RateLimitStore {
  increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAt: number }>;
  ready?(): Promise<void>;
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

export async function initializeRateLimitStore(
  config: RateLimitRuntimeConfig,
  createRedisStore?: (redisUrl: string) => RateLimitStore,
): Promise<RateLimitStore> {
  const store = createConfiguredRateLimitStore(config, createRedisStore);
  if (!config.distributed) return store;

  try {
    if (!store.ready) throw new Error("Store does not expose readiness");
    await store.ready();
    return store;
  } catch {
    throw new Error("Rate limit Redis is unavailable; startup aborted");
  }
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

interface ExpiryEntry {
  key: string;
  resetAt: number;
}

export interface InMemoryRateLimitStoreOptions {
  now?: () => number;
  maxEntries?: number;
}

/** Deterministic, bounded adapter for tests and local development. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, MemoryBucket>();
  private readonly expiryHeap: ExpiryEntry[] = [];
  private readonly now: () => number;
  private readonly maxEntries: number;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  get size() {
    return this.buckets.size;
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
      this.evictEarliestExpiry();
    }

    const bucket = { count: 1, resetAt: now + windowMs };
    this.buckets.set(key, bucket);
    this.pushExpiry({ key, resetAt: bucket.resetAt });
    return bucket;
  }

  private removeExpired(now: number) {
    while (this.expiryHeap[0]?.resetAt <= now) {
      const expired = this.popExpiry();
      if (!expired) return;
      const bucket = this.buckets.get(expired.key);
      if (bucket?.resetAt === expired.resetAt) this.buckets.delete(expired.key);
    }
  }

  private evictEarliestExpiry() {
    let entry: ExpiryEntry | undefined;
    while ((entry = this.popExpiry())) {
      const bucket = this.buckets.get(entry.key);
      if (bucket?.resetAt === entry.resetAt) {
        this.buckets.delete(entry.key);
        return;
      }
    }
  }

  private pushExpiry(entry: ExpiryEntry) {
    this.expiryHeap.push(entry);
    let index = this.expiryHeap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.expiryHeap[parent].resetAt <= entry.resetAt) break;
      this.expiryHeap[index] = this.expiryHeap[parent];
      index = parent;
    }
    this.expiryHeap[index] = entry;
  }

  private popExpiry(): ExpiryEntry | undefined {
    const first = this.expiryHeap[0];
    const last = this.expiryHeap.pop();
    if (!first || !last || this.expiryHeap.length === 0) return first;

    let index = 0;
    this.expiryHeap[0] = last;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.expiryHeap.length) break;
      const child =
        right < this.expiryHeap.length &&
        this.expiryHeap[right].resetAt < this.expiryHeap[left].resetAt
          ? right
          : left;
      if (this.expiryHeap[index].resetAt <= this.expiryHeap[child].resetAt) {
        break;
      }
      [this.expiryHeap[index], this.expiryHeap[child]] = [
        this.expiryHeap[child],
        this.expiryHeap[index],
      ];
      index = child;
    }
    return first;
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
        lazyConnect: true,
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

  async ready() {
    if (this.redis.status !== "ready") {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => finish(new Error("Redis readiness timed out")),
          5_000,
        );
        const onReady = () => finish();
        const onError = (error: Error) => finish(error);
        const finish = (error?: Error) => {
          clearTimeout(timeout);
          this.redis.off("ready", onReady);
          this.redis.off("error", onError);
          if (error) reject(error);
          else resolve();
        };
        this.redis.once("ready", onReady);
        this.redis.once("error", onError);
        if (this.redis.status === "wait") {
          void this.redis.connect().catch(onError);
        }
      });
    }
    const response = await this.redis.ping();
    if (response !== "PONG") throw new Error("Unexpected Redis ping response");
  }

  async close() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
