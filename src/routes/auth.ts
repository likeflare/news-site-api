import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import { getDatabaseClient } from "../config/database";

const router = Router();

// Get the correct frontend URL based on the request
function getFrontendUrl(req: any): string {
  // Check Referer header first
  const referer = req.get('referer') || req.get('referrer');
  if (referer) {
    const url = new URL(referer);
    const origin = `${url.protocol}//${url.host}`;
    
    // Verify it's an allowed origin
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
  }
  
  // Check Origin header
  const origin = req.get('origin');
  if (origin) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
  }
  
  // Check X-Forwarded-Host header
  const forwardedHost = req.get('x-forwarded-host');
  const forwardedProto = req.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    const forwardedOrigin = `${forwardedProto}://${forwardedHost}`;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
    if (allowedOrigins.includes(forwardedOrigin)) {
      return forwardedOrigin;
    }
  }
  
  // Default to first allowed origin
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
  return allowedOrigins[0];
}

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/api/auth/callback/google`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const client = getDatabaseClient();
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const avatar_url = profile.photos?.[0]?.value;

        if (!email) {
          return done(new Error("No email found in Google profile"));
        }

        // Check if user exists
        const existingUser = await client.execute({
          sql: "SELECT id, name, email, avatar_url, role FROM users WHERE email = ?",
          args: [email],
        });

        let user;

        if (existingUser.rows.length === 0) {
          // Create new user
          const userId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const now = Math.floor(Date.now() / 1000);

          await client.execute({
            sql: `
              INSERT INTO users (
                id, name, email, avatar_url, provider, provider_id, role,
                created_at, updated_at, created_at_int, updated_at_int
              ) VALUES (?, ?, ?, ?, 'google', ?, 'user', datetime('now'), datetime('now'), ?, ?)
            `,
            args: [userId, name, email, avatar_url || null, profile.id, now, now],
          });

          user = {
            id: userId,
            name,
            email,
            avatar_url,
            role: "user",
          };
        } else {
          user = existingUser.rows[0];
        }

        return done(null, user);
      } catch (error) {
        console.error("OAuth error:", error);
        return done(error as Error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// Store the frontend URL in session/state during OAuth initiation
router.get("/google", (req, res, next) => {
  const frontendUrl = getFrontendUrl(req);
  
  // Store frontend URL in state parameter
  const state = Buffer.from(JSON.stringify({ frontendUrl })).toString('base64');
  
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state
  })(req, res, next);
});

// Google OAuth callback
router.get(
  "/callback/google",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/error" }),
  (req, res) => {
    try {
      const user = req.user as any;

      // Generate JWT token
      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!,
        { expiresIn: "7d" }
      );

      // Get frontend URL from state parameter or fallback
      let frontendUrl = "http://localhost:3000";
      
      try {
        const state = req.query.state as string;
        if (state) {
          const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
          if (decoded.frontendUrl) {
            frontendUrl = decoded.frontendUrl;
          }
        }
      } catch (e) {
        // Fallback to getting from request
        frontendUrl = getFrontendUrl(req);
      }

      // Redirect to frontend with token
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error("Callback error:", error);
      const frontendUrl = getFrontendUrl(req);
      res.redirect(`${frontendUrl}/auth/error`);
    }
  }
);

// Get current user from token
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!) as any;

    // Fetch fresh user data from database
    const client = getDatabaseClient();
    const result = await client.execute({
      sql: "SELECT id, name, email, avatar_url, role FROM users WHERE id = ?",
      args: [decoded.sub],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get user error:", error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Sign out endpoint
router.post("/signout", (req, res) => {
  res.json({ success: true });
});


// Refresh token endpoint - generates new access token from refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!
    ) as any;

    // Validate token type
    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    // Fetch fresh user data from database to ensure user still exists and get current role
    const client = getDatabaseClient();
    const result = await client.execute({
      sql: "SELECT id, name, email, avatar_url, role FROM users WHERE id = ? AND email = ?",
      args: [decoded.sub, decoded.email],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Generate new access token with current user data
    const newAccessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.avatar_url,
        type: "access",
      },
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!,
      { expiresIn: "1h" }
    );

    res.json({ 
      accessToken: newAccessToken,
      expiresIn: 3600 // 1 hour in seconds
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Refresh token expired" });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    res.status(500).json({ error: "Token refresh failed" });
  }
});

export default router;
