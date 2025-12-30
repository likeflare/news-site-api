import rateLimit from "express-rate-limit";

// Use standardHeaders for IP detection to avoid IPv6 bypass issues
// The library handles IPv6 normalization automatically

export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "500"),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});

export const writeRateLimiter = rateLimit({
  windowMs: 60000,
  max: 20,
  message: "Too many write operations, please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const commentRateLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  message: "Too many comments, please wait before posting again.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminRateLimiter = rateLimit({
  windowMs: 60000,
  max: 200,
  message: "Too many admin operations, please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: async (req, res) => {
    const attempts = (req as any).rateLimit?.current || 0;
    const delay = Math.min(attempts * 1000, 5000);

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    res.status(429).json({
      error: "Too many authentication attempts",
      retryAfter: Math.ceil(
        (req as any).rateLimit?.resetTime || Date.now() + 900000,
      ),
    });
  },
});
