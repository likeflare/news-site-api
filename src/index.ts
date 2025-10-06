import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { testDatabaseConnection } from "./config/database";
import { globalRateLimiter, authRateLimiter } from "./middleware/rateLimit";

// Import public routes
import articlesRouter from "./routes/articles";
import commentsRouter from "./routes/comments";
import authorsRouter from "./routes/authors";
import categoriesRouter from "./routes/categories";
import tagsRouter from "./routes/tags";
import trendingRouter from "./routes/trending";
import relatedRouter from "./routes/related";
import searchRouter from "./routes/search";
import articleLikesRouter from "./routes/article-likes";

// Import admin routes
import adminCommentsRouter from "./routes/admin/comments";
import adminAuthorsRouter from "./routes/admin/authors";
import adminCategoriesRouter from "./routes/admin/categories";
import adminTagsRouter from "./routes/admin/tags";
import authRouter from "./routes/auth";
import passport from "passport";
import usersRouter from "./routes/users";
import adminArticlesRouter from "./routes/admin/articles";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;


// Trust proxy for Fly.io deployment (required for rate limiting with X-Forwarded-For)
app.set("trust proxy", true);

// SECURITY: Strict CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");

app.use((req, res, next) => {
  const origin = req.get("origin");
  const userAgent = req.get("user-agent") || "";

  // SECURITY FIX: Strict origin validation - no wildcards with credentials
  // Special handling for Next.js SSR/Build (server-to-server requests have no origin)
  if (!origin) {
    // Allow server-side requests from known build servers only
    const forwardedFor = req.get("x-forwarded-for");
    const host = req.get("host");
    
    // In production, validate server-side requests more strictly
    if (process.env.NODE_ENV === "production") {
      // Only allow if it's from our own backend or known build infrastructure
      if (host?.includes("fly.dev") || userAgent.includes("Next.js")) {
        res.header("Access-Control-Allow-Origin", allowedOrigins[0]);
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        
        if (req.method === "OPTIONS") {
          return res.sendStatus(200);
        }
        return next();
      }
      
      // Block unknown server-side requests in production
      return res.status(403).json({ error: "Origin required" });
    }
    
    // Development: Allow server-side requests but log them
    console.log(`[CORS] Server-side request from ${userAgent} - ${req.method} ${req.path}`);
    res.header("Access-Control-Allow-Origin", allowedOrigins[0]);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    return next();
  }

  // Standard CORS for browser requests with strict origin checking
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    return next();
  }

  // Block requests from unknown origins
  console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
  return res.status(403).json({ error: "Not allowed by CORS" });
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Body parsing with size limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Passport initialization
app.use(passport.initialize());

// Global rate limiting
app.use(globalRateLimiter);

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public API routes
app.use("/api/articles", articlesRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/authors", authorsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/auth", authRateLimiter, authRouter);
app.use("/api/users", usersRouter);
app.use("/api/trending", trendingRouter);
app.use("/api/related", relatedRouter);
app.use("/api/search", searchRouter);
app.use("/api/article-likes", articleLikesRouter);

// Admin API routes
app.use("/api/admin/articles", adminArticlesRouter);
app.use("/api/admin/comments", adminCommentsRouter);
app.use("/api/admin/authors", adminAuthorsRouter);
app.use("/api/admin/categories", adminCategoriesRouter);
app.use("/api/admin/tags", adminTagsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Secure error handler - prevents information leakage
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log full error details server-side only
  console.error("Error occurred:", {
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Never expose internal error details in production
  if (process.env.NODE_ENV === "production") {
    // Generic error messages based on status code
    const safeMessages: { [key: number]: string } = {
      400: "Bad request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not found",
      429: "Too many requests",
      500: "Internal server error",
      503: "Service unavailable",
    };

    return res.status(statusCode).json({
      error: safeMessages[statusCode] || "An error occurred",
    });
  }

  // In development, provide more details for debugging
  res.status(statusCode).json({
    error: err.message || "An error occurred",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      details: err.details,
    }),
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.error("Failed to connect to database. Exiting...");
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
      console.log(`🔒 CORS: Strict mode enabled (no wildcards with credentials)`);
      console.log(`\n📡 Available endpoints:`);
      console.log(`   Public:`);
      console.log(`   - GET  /api/articles`);
      console.log(`   - GET  /api/articles/:slug`);
      console.log(`   - GET  /api/comments`);
      console.log(`   - POST /api/comments`);
      console.log(`   - POST /api/comments/:commentId/like`);
      console.log(`   - POST /api/article-likes/:articleId`);
      console.log(`   - GET  /api/article-likes/:articleId`);
      console.log(`   - GET  /api/authors`);
      console.log(`   - GET  /api/authors/:slug`);
      console.log(`   - GET  /api/categories`);
      console.log(`   - GET  /api/categories/:slug`);
      console.log(`   - GET  /api/tags`);
      console.log(`   - GET  /api/tags/:slug`);
      console.log(`   - GET  /api/trending`);
      console.log(`   - GET  /api/related`);
      console.log(`   - GET  /api/search`);
      console.log(`   Admin (requires authentication):`);
      console.log(`   - /api/admin/articles (GET, POST, PUT, DELETE)`);
      console.log(`   - /api/admin/comments (GET, PUT, DELETE)`);
      console.log(`   - /api/admin/authors (GET, POST, PUT, DELETE)`);
      console.log(`   - /api/admin/categories (GET, POST, PUT, DELETE)`);
      console.log(`   - /api/admin/tags (GET, POST, PUT, DELETE)`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
