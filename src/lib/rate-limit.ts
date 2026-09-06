/**
 * In-memory sliding window rate limiter for Next.js route handlers.
 * Protects auth and search endpoints against brute-force and scraping.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale records every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit: number;       // max allowed requests
  windowMs: number;    // window duration in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return { success: true, remaining: options.limit - 1 };
  }

  if (record.count >= options.limit) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: options.limit - record.count,
  };
}

/**
 * Extract client IP from Next.js request headers
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") || "unknown";
}
