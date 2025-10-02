import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";
import { validateBody } from "../../middleware/validation";
import { updateCommentSchema } from "../../middleware/validation";

const router = Router();

// All admin routes require authentication
router.use(requireAdmin);
router.use(adminRateLimiter);

// GET /api/admin/comments - List all comments
router.get("/", async (req, res) => {
  try {
    const { limit = "50", offset = "0", approved } = req.query;
    const client = getDatabaseClient();

    let query = `
      SELECT c.*,
             a.title as article_title, a.slug as article_slug,
             cat.slug as category_slug
      FROM comments c
      LEFT JOIN articles a ON c.article_id = a.id
      LEFT JOIN categories cat ON a.category_id = cat.id
      WHERE 1=1
    `;

    const args: any[] = [];

    if (approved === "true") {
      query += ` AND c.is_approved = 1`;
    } else if (approved === "false") {
      query += ` AND c.is_approved = 0`;
    }

    query += ` ORDER BY c.created_at_int DESC LIMIT ? OFFSET ?`;
    args.push(parseInt(limit as string), parseInt(offset as string));

    const result = await client.execute({ sql: query, args });

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM comments WHERE 1=1`;
    if (approved === "true") countQuery += ` AND is_approved = 1`;
    if (approved === "false") countQuery += ` AND is_approved = 0`;

    const countResult = await client.execute(countQuery);

    res.json({
      comments: result.rows,
      total: countResult.rows[0].total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("Admin get comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// PUT /api/admin/comments/:id - Update comment
router.put("/:id", validateBody(updateCommentSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { content, is_approved } = req.body;
    const client = getDatabaseClient();

    const updates: string[] = [];
    const args: any[] = [];

    if (content !== undefined) {
      updates.push("content = ?");
      args.push(content);
    }

    if (is_approved !== undefined) {
      updates.push("is_approved = ?");
      args.push(is_approved ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    updates.push("updated_at = datetime('now')");
    updates.push("updated_at_int = ?");
    args.push(Math.floor(Date.now() / 1000));

    args.push(id);

    await client.execute({
      sql: `UPDATE comments SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update comment error:", error);
    res.status(500).json({ error: "Failed to update comment" });
  }
});

// DELETE /api/admin/comments/:id - Delete comment
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    // Delete comment and its replies (cascade)
    await client.execute({
      sql: "DELETE FROM comments WHERE id = ? OR parent_id = ?",
      args: [id, id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete comment error:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
