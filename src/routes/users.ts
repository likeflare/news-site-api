import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { z } from "zod";

const router = Router();

// Validation schema for creating a user
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  avatar_url: z.string().url().optional(),
  provider: z.string().min(1),
  provider_id: z.string().min(1),
});

// POST /api/users - Create new user (called by NextAuth during sign-in)
router.post("/", async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid user data", details: validation.error });
    }

    const { email, name, avatar_url, provider, provider_id } = validation.data;
    const client = getDatabaseClient();

    // Check if user already exists
    const existingUser = await client.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "User already exists" });
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

    // Fetch the created user
    const userResult = await client.execute({
      sql: "SELECT id, name, email, avatar_url, provider, provider_id, role, created_at, updated_at FROM users WHERE id = ?",
      args: [userId],
    });

    res.status(201).json({
      success: true,
      user: userResult.rows[0],
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// GET /api/users/:email - Get user by email (for authentication)
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: "SELECT id, name, email, avatar_url, provider, provider_id, role, created_at, updated_at FROM users WHERE email = ?",
      args: [decodeURIComponent(email)],
    });

    if (result.rows.length === 0) {
      return res.json({ user: null });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
