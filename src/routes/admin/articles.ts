import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";

const router = Router();

router.use(requireAdmin);
router.use(adminRateLimiter);

// GET /api/admin/articles - List all articles with filters
router.get("/", async (req, res) => {
  try {
    const {
      limit = "50",
      offset = "0",
      status,
      categoryId,
      authorId,
      search
    } = req.query;

    const client = getDatabaseClient();

    let query = `
      SELECT a.id, a.title, a.slug, a.excerpt, a.content, a.tldr, a.image_url,
             a.author_id, a.category_id, a.read_time, a.view_count, a.like_count,
             a.is_featured, a.is_published, a.published_at_int, a.created_at_int, a.updated_at_int,
             au.name as author_name, au.slug as author_slug, au.avatar_url as author_avatar,
             c.name as category_name, c.slug as category_slug, c.color as category_color,
             (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as comment_count
      FROM articles a
      LEFT JOIN authors au ON a.author_id = au.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status === "published") {
      query += ` AND a.is_published = 1`;
    } else if (status === "draft") {
      query += ` AND a.is_published = 0`;
    }

    if (categoryId) {
      query += ` AND a.category_id = ?`;
      params.push(categoryId);
    }

    if (authorId) {
      query += ` AND a.author_id = ?`;
      params.push(authorId);
    }

    if (search) {
      query += ` AND (a.title LIKE ? OR a.content LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY a.created_at_int DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await client.execute({ sql: query, args: params });

    const articles = result.rows.map((row: any) => ({
      ...row,
      comment_count: Number(row.comment_count || 0),
    }));

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM articles WHERE 1=1`;
    const countParams: any[] = [];

    if (status === "published") countQuery += ` AND is_published = 1`;
    if (status === "draft") countQuery += ` AND is_published = 0`;
    if (categoryId) {
      countQuery += ` AND category_id = ?`;
      countParams.push(categoryId);
    }
    if (authorId) {
      countQuery += ` AND author_id = ?`;
      countParams.push(authorId);
    }

    const countResult = await client.execute({
      sql: countQuery,
      args: countParams,
    });

    res.json({
      articles,
      total: countResult.rows[0].total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("Admin get articles error:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// POST /api/admin/articles - Create new article
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const client = getDatabaseClient();

    const id = `article-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Math.floor(Date.now() / 1000);

    await client.execute({
      sql: `INSERT INTO articles (
        id, title, slug, excerpt, content, tldr, image_url,
        author_id, category_id, read_time, is_featured, is_published,
        published_at_int, created_at_int, updated_at_int
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.title,
        body.slug,
        body.excerpt || null,
        body.content || null,
        body.tldr || null,
        body.image_url || null,
        body.author_id,
        body.category_id || null,
        body.read_time || "5 min",
        body.is_featured ? 1 : 0,
        body.is_published ? 1 : 0,
        body.is_published ? now : null,
        now,
        now,
      ],
    });

    // Add tags if provided
    if (body.tags && body.tags.length > 0) {
      for (const tagId of body.tags) {
        await client.execute({
          sql: "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
          args: [id, tagId],
        });
      }
    }

    res.status(201).json({ success: true, id });
  } catch (error) {
    console.error("Admin create article error:", error);
    res.status(500).json({ error: "Failed to create article" });
  }
});

// PUT /api/admin/articles - Update article (ID in body for frontend compatibility)
router.put("/", async (req, res) => {
  try {
    const body = req.body;
    const id = body.id;
    
    if (!id) {
      return res.status(400).json({ error: "Article ID required in body" });
    }

    const client = getDatabaseClient();
    const now = Math.floor(Date.now() / 1000);

    // Update article
    await client.execute({
      sql: `UPDATE articles SET
        title = ?, slug = ?, excerpt = ?, content = ?, tldr = ?,
        image_url = ?, author_id = ?, category_id = ?, read_time = ?,
        is_featured = ?, is_published = ?,
        published_at_int = CASE WHEN ? = 1 AND published_at_int IS NULL THEN ? ELSE published_at_int END,
        updated_at_int = ?
      WHERE id = ?`,
      args: [
        body.title,
        body.slug,
        body.excerpt || null,
        body.content || null,
        body.tldr || null,
        body.image_url || null,
        body.author_id,
        body.category_id || null,
        body.read_time || "5 min",
        body.is_featured ? 1 : 0,
        body.is_published ? 1 : 0,
        body.is_published ? 1 : 0,
        now,
        now,
        id,
      ],
    });

    // Update tags - delete old ones and insert new ones
    if (body.tags) {
      await client.execute({
        sql: "DELETE FROM article_tags WHERE article_id = ?",
        args: [id],
      });

      for (const tagId of body.tags) {
        await client.execute({
          sql: "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
          args: [id, tagId],
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update article error:", error);
    res.status(500).json({ error: "Failed to update article" });
  }
});

// DELETE /api/admin/articles - Bulk delete
router.delete("/", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs array required" });
    }
    const client = getDatabaseClient();
    for (const id of ids) {
      await client.execute({ sql: "DELETE FROM article_tags WHERE article_id = ?", args: [id] });
      await client.execute({ sql: "DELETE FROM articles WHERE id = ?", args: [id] });
    }
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Admin bulk delete articles error:", error);
    res.status(500).json({ error: "Failed to delete articles" });
  }
});

// GET /api/admin/articles/:id - Get single article
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: "SELECT * FROM articles WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Get tags
    const tagsResult = await client.execute({
      sql: `SELECT t.* FROM tags t
            JOIN article_tags at ON t.id = at.tag_id
            WHERE at.article_id = ?`,
      args: [id],
    });

    res.json({
      article: result.rows[0],
      tags: tagsResult.rows,
    });
  } catch (error) {
    console.error("Admin get article error:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// PUT /api/admin/articles/:id - Update article (alternative URL pattern)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const client = getDatabaseClient();
    const now = Math.floor(Date.now() / 1000);

    // Update article
    await client.execute({
      sql: `UPDATE articles SET
        title = ?, slug = ?, excerpt = ?, content = ?, tldr = ?,
        image_url = ?, author_id = ?, category_id = ?, read_time = ?,
        is_featured = ?, is_published = ?,
        published_at_int = CASE WHEN ? = 1 AND published_at_int IS NULL THEN ? ELSE published_at_int END,
        updated_at_int = ?
      WHERE id = ?`,
      args: [
        body.title,
        body.slug,
        body.excerpt || null,
        body.content || null,
        body.tldr || null,
        body.image_url || null,
        body.author_id,
        body.category_id || null,
        body.read_time || "5 min",
        body.is_featured ? 1 : 0,
        body.is_published ? 1 : 0,
        body.is_published ? 1 : 0,
        now,
        now,
        id,
      ],
    });

    // Update tags - delete old ones and insert new ones
    if (body.tags) {
      await client.execute({
        sql: "DELETE FROM article_tags WHERE article_id = ?",
        args: [id],
      });

      for (const tagId of body.tags) {
        await client.execute({
          sql: "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
          args: [id, tagId],
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update article error:", error);
    res.status(500).json({ error: "Failed to update article" });
  }
});

// DELETE /api/admin/articles/:id - Delete article
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    // Delete article tags first
    await client.execute({
      sql: "DELETE FROM article_tags WHERE article_id = ?",
      args: [id],
    });

    // Delete article
    await client.execute({
      sql: "DELETE FROM articles WHERE id = ?",
      args: [id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete article error:", error);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

export default router;
