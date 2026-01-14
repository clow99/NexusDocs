/**
 * Minimal in-memory rate limiter.
 *
 * Notes:
 * - Works best on a single long-lived Node process. In serverless/edge it is
 *   "best effort" per instance, but still useful as a baseline.
 * - Keys should NOT contain secrets (use userId, ip hash, etc).
 */
 
const STORE_KEY = "__nexus_rate_limit_store__";
 
function getStore() {
  if (!globalThis[STORE_KEY]) globalThis[STORE_KEY] = new Map();
  return globalThis[STORE_KEY];
}
 
function nowMs() {
  return Date.now();
}
 
/**
 * @param {object} input
 * @param {string} input.key
 * @param {number} input.limit
 * @param {number} input.windowMs
 * @returns {{ ok: boolean, remaining: number, resetAt: number, retryAfterSeconds: number }}
 */
export function rateLimit(input) {
  const key = String(input?.key || "");
  const limit = Number(input?.limit || 0);
  const windowMs = Number(input?.windowMs || 0);
 
  if (!key || !Number.isFinite(limit) || !Number.isFinite(windowMs) || limit <= 0 || windowMs <= 0) {
    return { ok: true, remaining: Infinity, resetAt: nowMs() + windowMs, retryAfterSeconds: 0 };
  }
 
  const store = getStore();
  const now = nowMs();
 
  const existing = store.get(key);
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfterSeconds: 0 };
  }
 
  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, remaining: 0, resetAt: existing.resetAt, retryAfterSeconds };
  }
 
  existing.count += 1;
  store.set(key, existing);
  return { ok: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt, retryAfterSeconds: 0 };
}
 
