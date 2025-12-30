import rateLimit from "express-rate-limit";

function getClientIp(req: any): string {
  const flyClientIp = req.get("fly-client-ip");
  if (flyClientIp) return flyClientIp;
  return req.ip || "unknown";
}

export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "500"),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  skip: (req) => req.path === '/health',
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    ip: false,
  },
});

export const writeRateLimiter = rateLimit({
  windowMs: 60000,
  max: 20,
  message: "Too many write operations, please slow down.",
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    ip: false,
  },
});

export const commentRateLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  message: "Too many comments, please wait before posting again.",
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    ip: false,
  },
});

export const adminRateLimiter = rateLimit({
  windowMs: 60000,
  max: 200,
  message: "Too many admin operations, please slow down.",
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    ip: false,
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    ip: false,
  },
  handler: async (req, res) => {
    const ip = getClientIp(req);
    const attempts = (req as any).rateLimit?.current || 0;

    const delay = Math.min(attempts * 1000, 5000);

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    res.status(429).json({
      error: "Too many authentication attempts",
      retryAfter: Math.ceil((req as any).rateLimit?.resetTime || Date.now() + 900000)
    });
  },
});
