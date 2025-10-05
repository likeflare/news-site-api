import rateLimit from "express-rate-limit";

// Global rate limiter - increased for build process
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "500"), // Increased from 100 to 500 for builds
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for same IP making many different requests (like during build)
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Strict rate limiter for write operations
export const writeRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20, // Increased from 10 to 20
  message: "Too many write operations, please slow down.",
});

// Comment creation rate limiter
export const commentRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // 5 comments per minute
  message: "Too many comments, please wait before posting again.",
});

// Admin operations rate limiter
export const adminRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 200, // Increased from 100 to 200
  message: "Too many admin operations, please slow down.",
});

// Auth brute force protection - very strict
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});
