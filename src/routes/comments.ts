import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { commentRateLimiter } from "../middleware/rateLimit";
import { validateQuery, commentsQuerySchema } from "../middleware/validation";
import { validateBody } from "../middleware/validation";
import { createCommentSchema } from "../middleware/validation";
import { sanitizeCommentContent } from "../middleware/sanitize";

const router = Router();

// GET /api/comments?articleId=xxx
router.get("/", optionalAuth, validateQuery(commentsQuerySchema), async (req, res) => {
  try {
    const { articleId } = req.query;
    const user = (req as any).user;

    if (!articleId || typeof articleId !== "string") {
      return res.status(400).json({ error: "Article ID is required" });
    }

    const client = getDatabaseClient();

    // Fetch top-level comments
    const result = await client.execute({
      sql: `
        SELECT c.*, 
               COALESCE(COUNT(DISTINCT cl.id), 0) as like_count,
               COALESCE(MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END), 0) as isLikedByUser
        FROM comments c
        LEFT JOIN comment_likes cl ON c.id = cl.comment_id
        WHERE c.article_id = ? AND c.parent_id IS NULL AND c.is_approved = 1
        GROUP BY c.id
        ORDER BY c.created_at_int DESC, c.created_at DESC
      `,
      args: [user?.userId || "", articleId],
    });

    // Fetch replies for each comment
    const comments = [];
    for (const row of result.rows) {
      const comment: any = {
        ...row,
        like_count: Number(row.like_count),
        isLikedByUser: Boolean(row.isLikedByUser),
        replies: [],
      };

      // Fetch replies
      const repliesResult = await client.execute({
        sql: `
          SELECT c.*, 
                 COALESCE(COUNT(DISTINCT cl.id), 0) as like_count,
                 COALESCE(MAX(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END), 0) as isLikedByUser
          FROM comments c
          LEFT JOIN comment_likes cl ON c.id = cl.comment_id
          WHERE c.parent_id = ? AND c.is_approved = 1
          GROUP BY c.id
          ORDER BY c.created_at_int ASC, c.created_at ASC
        `,
        args: [user?.userId || "", comment.id],
      });

      comment.replies = repliesResult.rows.map((r: any) => ({
        ...r,
        like_count: Number(r.like_count),
        isLikedByUser: Boolean(r.isLikedByUser),
      }));

      comments.push(comment);
    }

    res.json({ comments });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/comments - Create new comment (requires auth)
router.post(
  "/",
  requireAuth,
  commentRateLimiter,
  validateBody(createCommentSchema),
  async (req, res) => {
    try {
      const user = (req as any).user;
      const { articleId, content, parentId } = req.body;

      // Sanitize content
      const sanitizedContent = sanitizeCommentContent(content);

      if (sanitizedContent.trim().length === 0) {
        return res.status(400).json({ error: "Comment content cannot be empty" });
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

      // Verify parent comment exists if provided
      if (parentId) {
        const parentCheck = await client.execute({
          sql: "SELECT id FROM comments WHERE id = ? AND article_id = ?",
          args: [parentId, articleId],
        });

        if (parentCheck.rows.length === 0) {
          return res.status(404).json({ error: "Parent comment not found" });
        }
      }

      // Generate comment ID
      const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const now = Math.floor(Date.now() / 1000);

      // Insert comment
      await client.execute({
        sql: `
          INSERT INTO comments (
            id, article_id, parent_id, author_name, author_email,
            author_avatar, content, like_count, is_approved,
            created_at, updated_at, created_at_int, updated_at_int
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, datetime('now'), datetime('now'), ?, ?)
        `,
        args: [
          commentId,
          articleId,
          parentId || null,
          user.name,
          user.userId,
          null,
          sanitizedContent,
          now,
          now,
        ],
      });

      // Fetch the created comment
      const commentResult = await client.execute({
        sql: "SELECT * FROM comments WHERE id = ?",
        args: [commentId],
      });

      res.status(201).json({
        success: true,
        comment: commentResult.rows[0],
      });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  }
);

export default router;

// POST /api/comments/:commentId/like - Like/unlike a comment (requires auth)
router.post("/:commentId/like", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const user = (req as any).user;
    const client = getDatabaseClient();

    // Check if comment exists
    const commentCheck = await client.execute({
      sql: "SELECT id FROM comments WHERE id = ?",
      args: [commentId],
    });

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Check if user already liked this comment
    const likeCheck = await client.execute({
      sql: "SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?",
      args: [commentId, user.userId],
    });

    if (likeCheck.rows.length > 0) {
      // Unlike - remove the like
      await client.execute({
        sql: "DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?",
        args: [commentId, user.userId],
      });

      res.json({ success: true, action: "unliked" });
    } else {
      // Like - add the like
      const likeId = `like-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const now = Math.floor(Date.now() / 1000);

      await client.execute({
        sql: `
          INSERT INTO comment_likes (id, comment_id, user_id)
          VALUES (?, ?, ?)
        `,
        args: [likeId, commentId, user.userId],
      });

      res.json({ success: true, action: "liked" });
    }
  } catch (error) {
    console.error("Like comment error:", error);
    res.status(500).json({ error: "Failed to like/unlike comment" });
  }
});
