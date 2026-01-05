/**
 * Simple in-memory rate limiter for API routes
 * For production with multiple instances, consider using Upstash Redis
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (works for single instance, cleared on redeploy)
const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSec: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given identifier (e.g., IP address or user ID)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const key = identifier;

  const entry = store.get(key);

  if (!entry || entry.resetTime < now) {
    // New window
    store.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: config.limit - 1,
      reset: now + windowMs,
    };
  }

  if (entry.count >= config.limit) {
    // Rate limited
    return {
      success: false,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment count
  entry.count += 1;
  return {
    success: true,
    remaining: config.limit - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  // Vercel provides these headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  return "unknown";
}

// Preset configurations
export const RATE_LIMITS = {
  // Strict: for sensitive operations (login, signup, password reset)
  auth: { limit: 5, windowSec: 60 },

  // Moderate: for API calls
  api: { limit: 30, windowSec: 60 },

  // Relaxed: for general pages
  general: { limit: 100, windowSec: 60 },

  // Admin: for admin operations
  admin: { limit: 20, windowSec: 60 },
} as const;
