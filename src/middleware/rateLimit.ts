import rateLimit from "express-rate-limit";

/**
 * SECURITY: Custom key generator for Fly.io proxy setup
 * Uses fly-client-ip header which contains the real client IP
 * Falls back to req.ip if header not present
 */
function getClientIp(req: any): string {
  // Fly.io sets this header with the real client IP
  const flyClientIp = req.get("fly-client-ip");
  if (flyClientIp) return flyClientIp;
  
  // Fallback to Express req.ip (which uses X-Forwarded-For)
  return req.ip || "unknown";
}

// Global rate limiter - increased for build process
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "500"), // Increased from 100 to 500 for builds
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // SECURITY FIX: Use custom key generator to properly handle Fly.io proxy
  keyGenerator: getClientIp,
  // Skip rate limiting for health checks
  skip: (req) => {
    return req.path === '/health';
  },
  // Disable trust proxy validation (we handle it with custom key generator)
  validate: {
    trustProxy: false,
  },
});

// Strict rate limiter for write operations
export const writeRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20, // Increased from 10 to 20
  message: "Too many write operations, please slow down.",
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
  },
});

// Comment creation rate limiter
export const commentRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // 5 comments per minute
  message: "Too many comments, please wait before posting again.",
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
  },
});

// Admin operations rate limiter
export const adminRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 200, // Increased from 100 to 200
  message: "Too many admin operations, please slow down.",
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
  },
});

// Auth brute force protection - very strict
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
  },
});
