import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { commentRateLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validation";
import { createCommentSchema } from "../middleware/validation";
import { sanitizeCommentContent } from "../middleware/sanitize";

const router = Router();

// GET /api/comments?articleId=xxx
router.get("/", optionalAuth, async (req, res) => {
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
        SELECT
          c.id, c.article_id, c.parent_id, c.author_name,
          c.author_avatar, c.content, c.is_approved, c.created_at, c.updated_at,
          c.created_at_int, c.updated_at_int,
          (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count
        FROM comments c
        WHERE c.article_id = ? AND c.parent_id IS NULL AND c.is_approved = 1
        ORDER BY c.created_at_int DESC, c.created_at DESC
      `,
      args: [articleId],
    });

    // Fetch replies for each comment
    const comments = [];
    for (const row of result.rows) {
      const comment: any = {
        ...row,
        like_count: Number(row.like_count || 0),
        replies: [],
      };

      // Check if user liked this comment
      if (user?.id) {
        const likeCheck = await client.execute({
          sql: "SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?",
          args: [comment.id, user.id],
        });
        comment.isLikedByUser = likeCheck.rows.length > 0;
      } else {
        comment.isLikedByUser = false;
      }

      // Fetch replies with real-time like counts
      const repliesResult = await client.execute({
        sql: `
          SELECT
            c.id, c.article_id, c.parent_id, c.author_name,
            c.author_avatar, c.content, c.is_approved, c.created_at, c.updated_at,
            c.created_at_int, c.updated_at_int,
            (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count
          FROM comments c
          WHERE c.parent_id = ? AND c.is_approved = 1
          ORDER BY c.created_at_int ASC, c.created_at ASC
        `,
        args: [comment.id],
      });

      comment.replies = [];
      for (const r of repliesResult.rows) {
        const reply: any = {
          ...r,
          like_count: Number(r.like_count || 0),
        };

        // Check if user liked this reply
        if (user?.id) {
          const likeCheck = await client.execute({
            sql: "SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?",
            args: [reply.id, user.id],
          });
          reply.isLikedByUser = likeCheck.rows.length > 0;
        } else {
          reply.isLikedByUser = false;
        }

        comment.replies.push(reply);
      }

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

      // Insert comment (like_count starts at 0)
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
          user.email,
          user.image || null,
          sanitizedContent,
          now,
          now,
        ],
      });

      // Fetch the created comment
      const newCommentResult = await client.execute({
        sql: `SELECT * FROM comments WHERE id = ?`,
        args: [commentId],
      });

      const newComment = newCommentResult.rows[0];

      res.status(201).json({
        success: true,
        comment: {
          ...newComment,
          like_count: 0,
          isLikedByUser: false,
        },
      });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  }
);

// POST /api/comments/:commentId/like - Toggle like on comment
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
      args: [commentId, user.id],
    });

    let action: string;
    let newLikeCount: number;

    if (likeCheck.rows.length > 0) {
      // Unlike - remove the like
      await client.execute({
        sql: "DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?",
        args: [commentId, user.id],
      });

      // Get accurate count from comment_likes table
      const countResult = await client.execute({
        sql: "SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?",
        args: [commentId],
      });
      
      newLikeCount = Number(countResult.rows[0]?.count || 0);
      action = "unliked";
    } else {
      // Like - add the like
      const likeId = `like-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      await client.execute({
        sql: "INSERT INTO comment_likes (id, comment_id, user_id, created_at) VALUES (?, ?, ?, datetime('now'))",
        args: [likeId, commentId, user.id],
      });

      // Get accurate count from comment_likes table
      const countResult = await client.execute({
        sql: "SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?",
        args: [commentId],
      });
      
      newLikeCount = Number(countResult.rows[0]?.count || 0);
      action = "liked";
    }

    // Update the like_count column for consistency (best effort, don't fail if it errors)
    await client.execute({
      sql: "UPDATE comments SET like_count = ? WHERE id = ?",
      args: [newLikeCount, commentId],
    }).catch(() => {});

    res.json({
      success: true,
      action,
      like_count: newLikeCount,
      isLikedByUser: action === "liked",
    });
  } catch (error) {
    console.error("Like comment error:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

export default router;
