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
 * SECURITY FIX: Constant-time response to prevent user enumeration via timing attacks
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();

  try {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res
        .status(400)
        .json({ error: "Invalid user data", details: validation.error });
    }

    const { email, name, avatar_url, provider, provider_id, auth_secret } =
      validation.data;

    // Verify server-side secret token
    const expectedSecret = process.env.USER_CREATION_SECRET;
    if (!expectedSecret) {
      console.error("USER_CREATION_SECRET not configured");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Use timing-safe comparison to prevent timing attacks
    const secretMatch = crypto.timingSafeEqual(
      Buffer.from(auth_secret),
      Buffer.from(expectedSecret),
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

    let responseData;
    let statusCode;

    if (existingUser.rows.length > 0) {
      // User exists - return existing user data
      const user = existingUser.rows[0];
      roleCache.set(email, user.role as string);

      responseData = {
        success: true,
        user: {
          id: user.id,
          email: email,
          role: user.role,
        },
      };
      statusCode = 200;
    } else {
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
        args: [
          userId,
          name,
          email,
          avatar_url || null,
          provider,
          provider_id,
          now,
          now,
        ],
      });

      // Cache the role
      roleCache.set(email, "user");

      responseData = {
        success: true,
        user: {
          id: userId,
          email: email,
          role: "user",
        },
      };
      statusCode = 200; // Changed from 201 to 200 to match existing user response
    }

    // SECURITY: Add constant-time delay to prevent timing attacks
    // Ensure total response time is at least 150ms regardless of path taken
    const elapsed = Date.now() - startTime;
    const minimumDelay = 150;
    if (elapsed < minimumDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, minimumDelay - elapsed),
      );
    }

    return res.status(statusCode).json(responseData);
  } catch (error) {
    console.error("Create user error:", error);

    // Even on error, maintain constant timing
    const elapsed = Date.now() - startTime;
    const minimumDelay = 150;
    if (elapsed < minimumDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, minimumDelay - elapsed),
      );
    }

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
 * POST /api/users/lookup/email - Get user ID by email (for internal use)
 *
 * SECURITY FIX: Returns 403 if user tries to lookup email that isn't theirs
 * This prevents user enumeration by making it impossible for attackers to probe
 * arbitrary email addresses. Only authenticated users can lookup their own email,
 * or admins can lookup any email.
 */
router.post("/lookup/email", requireAuth, async (req, res) => {
  const startTime = Date.now();

  try {
    const { email } = req.body;
    const currentUser = (req as any).user;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // SECURITY FIX: Only allow users to lookup their own email (prevents enumeration)
    // Admins can lookup any email
    if (currentUser.email !== email && currentUser.role !== "admin") {
      // SECURITY: Add timing delay even for unauthorized requests
      const elapsed = Date.now() - startTime;
      const minimumDelay = 100;
      if (elapsed < minimumDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minimumDelay - elapsed),
        );
      }
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

        // SECURITY: Add timing delay for consistency
        const elapsed = Date.now() - startTime;
        const minimumDelay = 100;
        if (elapsed < minimumDelay) {
          await new Promise((resolve) =>
            setTimeout(resolve, minimumDelay - elapsed),
          );
        }

        return res.json({ user: null });
      }

      // SECURITY: Add timing delay for consistency
      const elapsed = Date.now() - startTime;
      const minimumDelay = 100;
      if (elapsed < minimumDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minimumDelay - elapsed),
        );
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
      // SECURITY: Add timing delay for consistency
      const elapsed = Date.now() - startTime;
      const minimumDelay = 100;
      if (elapsed < minimumDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, minimumDelay - elapsed),
        );
      }

      return res.json({ user: null });
    }

    const user = result.rows[0];
    roleCache.set(email, user.role as string);

    // SECURITY: Add timing delay for consistency
    const elapsed = Date.now() - startTime;
    const minimumDelay = 100;
    if (elapsed < minimumDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, minimumDelay - elapsed),
      );
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Email lookup error:", error);

    // SECURITY: Add timing delay even for errors
    const elapsed = Date.now() - startTime;
    const minimumDelay = 100;
    if (elapsed < minimumDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, minimumDelay - elapsed),
      );
    }

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

    let query =
      "SELECT id, name, email, avatar_url, role, created_at, updated_at FROM users WHERE 1=1";
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
