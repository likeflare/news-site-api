import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Validation schema for article ID
const articleIdSchema = z.object({
  articleId: z.string().min(1, "Article ID is required"),
});

/**
 * POST /api/article-likes/:articleId
 * Like or unlike an article
 * 
 * Security:
 * - Requires authentication (JWT token)
 * - Validates article exists
 * - Prevents duplicate likes via UNIQUE constraint
 * - Tracks per-user likes in database
 * - Returns accurate like count from database
 */
router.post("/:articleId", requireAuth, async (req, res) => {
  try {
    const { articleId } = req.params;
    const user = (req as any).user;

    // Validate article ID
    const validation = articleIdSchema.safeParse({ articleId });
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid article ID",
        details: validation.error.issues,
      });
    }

    const client = getDatabaseClient();

    // Verify article exists
    const articleCheck = await client.execute({
      sql: "SELECT id FROM articles WHERE id = ?",
      args: [articleId],
    });

    if (articleCheck.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Check if user already liked this article
    const likeCheck = await client.execute({
      sql: "SELECT id FROM article_likes WHERE article_id = ? AND user_id = ?",
      args: [articleId, user.id],
    });

    let action: "liked" | "unliked";

    if (likeCheck.rows.length > 0) {
      // Unlike - remove the like
      await client.execute({
        sql: "DELETE FROM article_likes WHERE article_id = ? AND user_id = ?",
        args: [articleId, user.id],
      });
      action = "unliked";
    } else {
      // Like - add the like
      const likeId = `like-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const now = Math.floor(Date.now() / 1000);

      await client.execute({
        sql: `
          INSERT INTO article_likes (id, article_id, user_id, created_at_int)
          VALUES (?, ?, ?, ?)
        `,
        args: [likeId, articleId, user.id, now],
      });
      action = "liked";
    }

    // Get accurate like count from database
    const countResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM article_likes WHERE article_id = ?",
      args: [articleId],
    });

    const likeCount = Number(countResult.rows[0]?.count || 0);

    res.json({
      success: true,
      action,
      likeCount,
      isLiked: action === "liked",
    });
  } catch (error) {
    console.error("Like article error:", error);
    
    // Handle unique constraint violation (race condition)
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return res.status(409).json({
        error: "Duplicate like detected",
        message: "You have already liked this article",
      });
    }

    res.status(500).json({ error: "Failed to like/unlike article" });
  }
});

/**
 * GET /api/article-likes/:articleId
 * Get like status for an article
 * 
 * Returns:
 * - Total like count (from database)
 * - Whether current user has liked (if authenticated)
 */
router.get("/:articleId", async (req, res) => {
  try {
    const { articleId } = req.params;
    
    // Validate article ID
    const validation = articleIdSchema.safeParse({ articleId });
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid article ID",
        details: validation.error.issues,
      });
    }

    const client = getDatabaseClient();

    // Get accurate like count from database
    const countResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM article_likes WHERE article_id = ?",
      args: [articleId],
    });

    const likeCount = Number(countResult.rows[0]?.count || 0);

    // Check if user has liked (if authenticated)
    const authHeader = req.headers.authorization;
    let isLiked = false;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const jwt = require("jsonwebtoken");
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const userId = decoded.sub;

        const likeCheck = await client.execute({
          sql: "SELECT id FROM article_likes WHERE article_id = ? AND user_id = ?",
          args: [articleId, userId],
        });

        isLiked = likeCheck.rows.length > 0;
      } catch (error) {
        // Invalid token, continue without user context
        console.warn("Invalid token in like status check:", error);
      }
    }

    res.json({
      likeCount,
      isLiked,
    });
  } catch (error) {
    console.error("Get like status error:", error);
    res.status(500).json({ error: "Failed to get like status" });
  }
});

export default router;
