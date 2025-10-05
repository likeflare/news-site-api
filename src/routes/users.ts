import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { z } from "zod";
import { roleCache } from "../utils/roleCache";
import { requireAuth, requireAdmin } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

// Validation schema for creating a user
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  avatar_url: z.string().url().optional(),
  provider: z.string().min(1),
  provider_id: z.string().min(1),
  auth_secret: z.string().min(1), // Server-side secret to validate legitimate requests
});

/**
 * POST /api/users - Create new user (called by NextAuth during sign-in)
 * 
 * Security: Requires server-side secret token to prevent unauthorized user creation
 * The secret should only be known to the NextAuth server
 */
router.post("/", async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: "Invalid user data", details: validation.error });
    }

    const { email, name, avatar_url, provider, provider_id, auth_secret } = validation.data;
    
    // Verify server-side secret token
    const expectedSecret = process.env.USER_CREATION_SECRET;
    if (!expectedSecret) {
      console.error("USER_CREATION_SECRET not configured");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Use timing-safe comparison to prevent timing attacks
    const secretMatch = crypto.timingSafeEqual(
      Buffer.from(auth_secret),
      Buffer.from(expectedSecret)
    );

    if (!secretMatch) {
      console.warn(`Unauthorized user creation attempt for email: ${email}`);
      return res.status(403).json({ error: "Unauthorized" });
    }

    const client = getDatabaseClient();

    // Check if user already exists
    const existingUser = await client.execute({
      sql: "SELECT id, role FROM users WHERE email = ?",
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      // User exists - return existing user data (useful for NextAuth callback)
      const user = existingUser.rows[0];
      roleCache.set(email, user.role as string);
      
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: email,
          role: user.role,
        },
        existed: true,
      });
    }

    // Generate user ID
    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Math.floor(Date.now() / 1000);

    // Create user with default 'user' role
    await client.execute({
      sql: `
        INSERT INTO users (
          id, name, email, avatar_url, provider, provider_id, role,
          created_at, updated_at, created_at_int, updated_at_int
        ) VALUES (?, ?, ?, ?, ?, ?, 'user', datetime('now'), datetime('now'), ?, ?)
      `,
      args: [userId, name, email, avatar_url || null, provider, provider_id, now, now],
    });

    // Cache the role
    roleCache.set(email, "user");

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        email: email,
        role: "user",
      },
      existed: false,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

/**
 * GET /api/users/me - Get current authenticated user's data
 * 
 * Security: User can only access their own data
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: "SELECT id, name, email, avatar_url, role, created_at, updated_at FROM users WHERE id = ?",
      args: [currentUser.id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * GET /api/users/:userId - Get user by ID
 * 
 * Security: Users can only access their own data, admins can access any user
 */
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user;
    const client = getDatabaseClient();

    // Check authorization: user can only access their own data, unless admin
    if (currentUser.id !== userId && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await client.execute({
      sql: "SELECT id, name, email, avatar_url, role, created_at, updated_at FROM users WHERE id = ?",
      args: [userId],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * GET /api/users/lookup/email - Get user ID by email (for internal use)
 * 
 * Security: Requires authentication. Returns minimal data (just ID and role for session)
 * This is used by NextAuth callbacks to fetch user data during sign-in
 */
router.post("/lookup/email", requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    const currentUser = (req as any).user;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // Only allow users to lookup their own email, or admins to lookup any email
    if (currentUser.email !== email && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const client = getDatabaseClient();

    // Check role cache first
    const cachedRole = roleCache.get(email);

    if (cachedRole !== null) {
      // Cache hit - minimal database query
      const result = await client.execute({
        sql: "SELECT id FROM users WHERE email = ?",
        args: [email],
      });

      if (result.rows.length === 0) {
        roleCache.invalidate(email);
        return res.json({ user: null });
      }

      return res.json({
        user: {
          id: result.rows[0].id,
          email: email,
          role: cachedRole,
        },
      });
    }

    // Cache miss - fetch from database
    const result = await client.execute({
      sql: "SELECT id, email, role FROM users WHERE email = ?",
      args: [email],
    });

    if (result.rows.length === 0) {
      return res.json({ user: null });
    }

    const user = result.rows[0];
    roleCache.set(email, user.role as string);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Email lookup error:", error);
    res.status(500).json({ error: "Failed to lookup user" });
  }
});

/**
 * GET /api/users - List all users (admin only)
 * 
 * Security: Requires admin role
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { limit = "50", offset = "0", search } = req.query;
    const client = getDatabaseClient();

    let query = "SELECT id, name, email, avatar_url, role, created_at, updated_at FROM users WHERE 1=1";
    const args: any[] = [];

    if (search) {
      query += " AND (name LIKE ? OR email LIKE ?)";
      const searchPattern = `%${search}%`;
      args.push(searchPattern, searchPattern);
    }

    query += " ORDER BY created_at_int DESC LIMIT ? OFFSET ?";
    args.push(parseInt(limit as string), parseInt(offset as string));

    const result = await client.execute({ sql: query, args });

    res.json({ users: result.rows });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * POST /api/users/invalidate-cache - Force refresh role cache
 * 
 * Security: Requires authentication. Users can only invalidate their own cache
 */
router.post("/invalidate-cache", requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    
    roleCache.invalidate(currentUser.email);

    res.json({ success: true, message: "Role cache invalidated" });
  } catch (error) {
    console.error("Invalidate cache error:", error);
    res.status(500).json({ error: "Failed to invalidate cache" });
  }
});

export default router;
