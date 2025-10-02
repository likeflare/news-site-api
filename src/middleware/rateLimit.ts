import rateLimit from "express-rate-limit";

// Global rate limiter
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for write operations
export const writeRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute
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
  max: 100, // 100 admin operations per minute
  message: "Too many admin operations, please slow down.",
});
