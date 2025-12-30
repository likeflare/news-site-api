import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { getDatabaseClient } from "../config/database";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  revokeToken,
  revokeUserTokens,
} from "../utils/tokens";
import { requireAuth } from "../middleware/auth";
import { logAdminAction } from "../utils/auditLog";

const router = Router();

function getFrontendUrl(req: any): string {
  const referer = req.get("referer") || req.get("referrer");
  if (referer) {
    const url = new URL(referer);
    const origin = `${url.protocol}//${url.host}`;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
  }

  const origin = req.get("origin");
  if (origin) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
  }

  const forwardedHost = req.get("x-forwarded-host");
  const forwardedProto = req.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    const forwardedOrigin = `${forwardedProto}://${forwardedHost}`;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");
    if (allowedOrigins.includes(forwardedOrigin)) {
      return forwardedOrigin;
    }
  }

  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:3000"
  ).split(",");
  return allowedOrigins[0];
}

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

        const existingUser = await client.execute({
          sql: "SELECT id, name, email, avatar_url, role FROM users WHERE email = ?",
          args: [email],
        });

        let user;

        if (existingUser.rows.length === 0) {
          const userId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const now = Math.floor(Date.now() / 1000);

          await client.execute({
            sql: `
              INSERT INTO users (
                id, name, email, avatar_url, provider, provider_id, role,
                created_at, updated_at, created_at_int, updated_at_int
              ) VALUES (?, ?, ?, ?, 'google', ?, 'user', datetime('now'), datetime('now'), ?, ?)
            `,
            args: [
              userId,
              name,
              email,
              avatar_url || null,
              profile.id,
              now,
              now,
            ],
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
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

router.get("/google", (req, res, next) => {
  const frontendUrl = getFrontendUrl(req);
  const state = Buffer.from(JSON.stringify({ frontendUrl })).toString("base64");

  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state,
  })(req, res, next);
});

router.get(
  "/callback/google",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/error",
  }),
  (req, res) => {
    try {
      const user = req.user as any;

      const accessToken = generateAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.avatar_url,
      });

      const refreshToken = generateRefreshToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      let frontendUrl = "http://localhost:3000";

      try {
        const state = req.query.state as string;
        if (state) {
          const decoded = JSON.parse(Buffer.from(state, "base64").toString());
          if (decoded.frontendUrl) {
            frontendUrl = decoded.frontendUrl;
          }
        }
      } catch (e) {
        frontendUrl = getFrontendUrl(req);
      }

      res.redirect(
        `${frontendUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`,
      );
    } catch (error) {
      console.error("Callback error:", error);
      const frontendUrl = getFrontendUrl(req);
      res.redirect(`${frontendUrl}/auth/error`);
    }
  },
);

router.get("/me", async (req, res) => {
  const startTime = Date.now();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 100)
        await new Promise((resolve) => setTimeout(resolve, 100 - elapsed));
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);

    const client = getDatabaseClient();
    const result = await client.execute({
      sql: "SELECT id, name, email, avatar_url, role FROM users WHERE id = ?",
      args: [decoded.sub],
    });

    if (result.rows.length === 0) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 100)
        await new Promise((resolve) => setTimeout(resolve, 100 - elapsed));
      return res.status(404).json({ error: "User not found" });
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < 100)
      await new Promise((resolve) => setTimeout(resolve, 100 - elapsed));

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get user error:", error);
    const elapsed = Date.now() - startTime;
    if (elapsed < 100)
      await new Promise((resolve) => setTimeout(resolve, 100 - elapsed));
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

router.post("/signout", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);

    if (token) {
      try {
        const decoded = await verifyAccessToken(token);
        if (decoded.jti) {
          const expiresAt = Date.now() + 60 * 60 * 1000;
          await revokeToken(decoded.jti, expiresAt, "User signout");
        }
      } catch (err) {
        // Token already invalid, ignore
      }
    }

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "SIGNOUT",
      resource: "auth",
      success: true,
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const decoded = await verifyRefreshToken(refreshToken);

    const client = getDatabaseClient();
    const result = await client.execute({
      sql: "SELECT id, name, email, avatar_url, role FROM users WHERE id = ? AND email = ?",
      args: [decoded.sub, decoded.email],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0] as any;

    const newAccessToken = generateAccessToken({
      sub: user.id as string,
      email: user.email as string,
      name: user.name as string,
      role: user.role as string,
      image: user.avatar_url as string,
    });

    const newRefreshToken = generateRefreshToken({
      sub: user.id as string,
      email: user.email as string,
      name: user.name as string,
      role: user.role as string,
    });

    // Revoke old refresh token
    if (decoded.jti) {
      const oldRefreshExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await revokeToken(decoded.jti, oldRefreshExpires, "Token refresh");
    }

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/revoke", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    await revokeUserTokens(user.id, "User requested token revocation");

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "REVOKE_ALL_TOKENS",
      resource: "auth",
      success: true,
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ success: true, message: "All tokens revoked" });
  } catch (error) {
    console.error("Token revocation error:", error);
    return res.status(500).json({ error: "Failed to revoke tokens" });
  }
});

export default router;
