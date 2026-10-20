import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";

/**
 * Minimal key-value surface the game needs. RedisStore is the real thing
 * (shared across server instances); MemoryStore keeps a single instance and
 * the tests running without Redis.
 */
export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  incrBy(key: string, by: number, ttlSeconds?: number): Promise<number>;
  /** Set only if absent, with an expiry in ms. Returns true if set. */
  setNx(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Delete only if the current value equals `value` (safe unlock). */
  delIfEquals(key: string, value: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  rpush(key: string, value: string, ttlSeconds?: number): Promise<void>;
  lrange(key: string): Promise<string[]>;
  quit(): Promise<void>;
}

export class RedisStore implements Store {
  constructor(readonly redis: Redis) {}

  get(key: string) {
    return this.redis.get(key);
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, "EX", ttlSeconds);
    else await this.redis.set(key, value);
  }
  async del(...keys: string[]) {
    if (keys.length) await this.redis.del(...keys);
  }
  async incrBy(key: string, by: number, ttlSeconds?: number) {
    const n = await this.redis.incrby(key, by);
    if (ttlSeconds) await this.redis.expire(key, ttlSeconds);
    return n;
  }
  async setNx(key: string, value: string, ttlMs: number) {
    return (await this.redis.set(key, value, "PX", ttlMs, "NX")) === "OK";
  }
  async delIfEquals(key: string, value: string) {
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      value,
    );
  }
  async sadd(key: string, member: string) {
    await this.redis.sadd(key, member);
  }
  async srem(key: string, member: string) {
    await this.redis.srem(key, member);
  }
  smembers(key: string) {
    return this.redis.smembers(key);
  }
  async rpush(key: string, value: string, ttlSeconds?: number) {
    await this.redis.rpush(key, value);
    if (ttlSeconds) await this.redis.expire(key, ttlSeconds);
  }
  lrange(key: string) {
    return this.redis.lrange(key, 0, -1);
  }
  async quit() {
    await this.redis.quit();
  }
}

export class MemoryStore implements Store {
  private kv = new Map<string, { value: string; expires: number | null }>();
  private sets = new Map<string, Set<string>>();
  private lists = new Map<string, string[]>();

  private live(key: string) {
    const entry = this.kv.get(key);
    if (entry && entry.expires !== null && entry.expires < Date.now()) {
      this.kv.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    this.kv.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }
  async del(...keys: string[]) {
    for (const k of keys) {
      this.kv.delete(k);
      this.sets.delete(k);
      this.lists.delete(k);
    }
  }
  async incrBy(key: string, by: number, ttlSeconds?: number) {
    const n = Number(this.live(key)?.value ?? 0) + by;
    await this.set(key, String(n), ttlSeconds);
    return n;
  }
  async setNx(key: string, value: string, ttlMs: number) {
    if (this.live(key)) return false;
    this.kv.set(key, { value, expires: Date.now() + ttlMs });
    return true;
  }
  async delIfEquals(key: string, value: string) {
    if (this.live(key)?.value === value) this.kv.delete(key);
  }
  async sadd(key: string, member: string) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key)!.add(member);
  }
  async srem(key: string, member: string) {
    this.sets.get(key)?.delete(member);
  }
  async smembers(key: string) {
    return [...(this.sets.get(key) ?? [])];
  }
  async rpush(key: string, value: string) {
    if (!this.lists.has(key)) this.lists.set(key, []);
    this.lists.get(key)!.push(value);
  }
  async lrange(key: string) {
    return [...(this.lists.get(key) ?? [])];
  }
  async quit() {}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Distributed lock with retry. Used for room state mutations and to make sure
 * a suspect answers one question at a time (their memory must stay ordered).
 */
export async function withLock<T>(
  store: Store,
  key: string,
  fn: () => Promise<T>,
  opts: { ttlMs?: number; waitMs?: number } = {},
): Promise<T> {
  const ttlMs = opts.ttlMs ?? 10_000;
  const waitMs = opts.waitMs ?? 10_000;
  const token = randomUUID();
  const deadline = Date.now() + waitMs;
  while (!(await store.setNx(key, token, ttlMs))) {
    if (Date.now() > deadline) throw new LockTimeoutError(key);
    await sleep(25 + Math.random() * 50);
  }
  try {
    return await fn();
  } finally {
    await store.delIfEquals(key, token);
  }
}

export class LockTimeoutError extends Error {
  constructor(key: string) {
    super(`Timed out waiting for lock ${key}`);
  }
}

export function createStore(redisUrl: string | undefined): Store {
  if (!redisUrl) return new MemoryStore();
  return new RedisStore(new Redis(redisUrl, { maxRetriesPerRequest: 3 }));
}
