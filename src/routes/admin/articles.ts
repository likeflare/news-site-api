import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";
import {
  sanitizeArticleContent,
  sanitizeText,
} from "../../middleware/sanitize";
import { logAdminAction } from "../../utils/auditLog";
import { generateId } from "../../utils/generateId";

const router = Router();

router.use(requireAdmin);
router.use(adminRateLimiter);

// GET /api/admin/articles - List all articles
router.get("/", async (req, res) => {
  try {
    const client = getDatabaseClient();
    const result = await client.execute({
      sql: `SELECT
            a.id, a.title, a.slug, a.excerpt, a.content, a.tldr, a.image_url,
            a.author_id, a.category_id, a.read_time, a.view_count, a.like_count,
            a.is_featured, a.is_published, a.published_at_int,
            a.created_at_int, a.updated_at_int,
            au.name as author_name,
            c.name as category_name, c.slug as category_slug, c.color as category_color,
            (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as real_comment_count
            FROM articles a
            LEFT JOIN authors au ON a.author_id = au.id
            LEFT JOIN categories c ON a.category_id = c.id
            ORDER BY a.created_at_int DESC`,
      args: [],
    });

    // Map results to include comment_count from the subquery
    const articles = result.rows.map((row: any) => ({
      ...row,
      comment_count: Number(row.real_comment_count || 0),
      view_count: Number(row.view_count || 0),
      like_count: Number(row.like_count || 0),
    }));

    // Include total count in response
    res.json({ articles, total: articles.length });
  } catch (error) {
    console.error("Get admin articles error:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// GET /api/admin/articles/:id - Get single article by ID
router.get("/:id", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    // Fetch article with relations
    const articleResult = await client.execute({
      sql: `SELECT
            a.id, a.title, a.slug, a.excerpt, a.content, a.tldr, a.image_url,
            a.author_id, a.category_id, a.read_time, a.view_count, a.like_count,
            a.is_featured, a.is_published, a.published_at_int,
            a.created_at_int, a.updated_at_int,
            au.name as author_name,
            c.name as category_name, c.slug as category_slug, c.color as category_color
            FROM articles a
            LEFT JOIN authors au ON a.author_id = au.id
            LEFT JOIN categories c ON a.category_id = c.id
            WHERE a.id = ?`,
      args: [id],
    });

    if (articleResult.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }

    const article = articleResult.rows[0];

    // Fetch associated tags
    const tagsResult = await client.execute({
      sql: `SELECT t.id, t.name, t.slug
            FROM tags t
            INNER JOIN article_tags at ON t.id = at.tag_id
            WHERE at.article_id = ?`,
      args: [id],
    });

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "VIEW_ARTICLE",
      resource: "article",
      resourceId: id,
      details: { title: article.title },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({
      article: {
        ...article,
        view_count: Number(article.view_count || 0),
        like_count: Number(article.like_count || 0),
      },
      tags: tagsResult.rows,
    });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "VIEW_ARTICLE",
      resource: "article",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Get article by ID error:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// POST /api/admin/articles - Create new article
router.post("/", async (req, res) => {
  const user = (req as any).user;
  try {
    const body = req.body;
    const client = getDatabaseClient();
    const now = Math.floor(Date.now() / 1000);
    const id = `article-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const sanitizedContent = body.content
      ? sanitizeArticleContent(body.content)
      : null;
    const sanitizedExcerpt = body.excerpt ? sanitizeText(body.excerpt) : null;
    const sanitizedTldr = body.tldr ? sanitizeText(body.tldr) : null;

    await client.execute({
      sql: `INSERT INTO articles (
        id, title, slug, excerpt, content, tldr, image_url, author_id, category_id, read_time,
        is_featured, is_published, published_at_int, created_at_int, updated_at_int
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.title,
        body.slug,
        sanitizedExcerpt,
        sanitizedContent,
        sanitizedTldr,
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

    // Handle tags if provided
    if (body.tags && Array.isArray(body.tags)) {
      for (const tagId of body.tags) {
        await client.execute({
          sql: `INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)`,
          args: [id, tagId],
        });
      }
    }

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "CREATE_ARTICLE",
      resource: "article",
      resourceId: id,
      details: { title: body.title, slug: body.slug },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true, article: { id }, id });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "CREATE_ARTICLE",
      resource: "article",
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Create article error:", error);
    res.status(500).json({ error: "Failed to create article" });
  }
});

// PATCH /api/admin/articles/:id/featured - Quick toggle featured status (optimized for instant response)
router.patch("/:id/featured", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const { is_featured } = req.body;

    const client = getDatabaseClient();
    const now = Math.floor(Date.now() / 1000);

    await client.execute({
      sql: `UPDATE articles SET is_featured = ?, updated_at_int = ? WHERE id = ?`,
      args: [is_featured ? 1 : 0, now, id],
    });

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: is_featured ? "FEATURE_ARTICLE" : "UNFEATURE_ARTICLE",
      resource: "article",
      resourceId: id,
      details: { is_featured },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    // Quick response - no need to fetch the full article
    res.json({ success: true, is_featured });
  } catch (error) {
    const user = (req as any).user;
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "TOGGLE_FEATURED",
      resource: "article",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Toggle featured error:", error);
    res.status(500).json({ error: "Failed to toggle featured status" });
  }
});

// PUT /api/admin/articles/:id - Update article
router.put("/:id", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.id; // Remove id from updates if present

    const client = getDatabaseClient();
    const now = Math.floor(Date.now() / 1000);

    // Sanitize content fields
    if (updates.content)
      updates.content = sanitizeArticleContent(updates.content);
    if (updates.excerpt) updates.excerpt = sanitizeText(updates.excerpt);
    if (updates.tldr) updates.tldr = sanitizeText(updates.tldr);

    // Handle tags separately
    const tags = updates.tags;
    delete updates.tags;
    delete updates.category_slug; // Remove read-only field
    delete updates.was_published; // Remove tracking field

    // Update published_at_int when publishing
    if (updates.is_published && !updates.published_at_int) {
      updates.published_at_int = now;
    }

    // Build update query
    const updateFields = Object.keys(updates).filter(
      (key) =>
        ![
          "id",
          "tags",
          "author_name",
          "category_name",
          "category_color",
          "category_slug",
          "comment_count",
          "real_comment_count",
        ].includes(key),
    );

    if (updateFields.length > 0) {
      const setFields = updateFields.map((key) => `${key} = ?`).join(", ");
      const values = [...updateFields.map((key) => updates[key]), now, id];

      await client.execute({
        sql: `UPDATE articles SET ${setFields}, updated_at_int = ? WHERE id = ?`,
        args: values,
      });
    }

    // Update tags if provided
    if (tags !== undefined && Array.isArray(tags)) {
      // Delete existing tags
      await client.execute({
        sql: `DELETE FROM article_tags WHERE article_id = ?`,
        args: [id],
      });

      // Insert new tags
      for (const tagId of tags) {
        await client.execute({
          sql: `INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)`,
          args: [id, tagId],
        });
      }
    }

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE_ARTICLE",
      resource: "article",
      resourceId: id,
      details: { fields: updateFields },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true });
  } catch (error) {
    const user = (req as any).user;
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE_ARTICLE",
      resource: "article",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Update article error:", error);
    res.status(500).json({ error: "Failed to update article" });
  }
});

// DELETE /api/admin/articles - Delete article(s) from request body
router.delete("/", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id, ids } = req.body;

    // Support both single ID and multiple IDs
    const idsToDelete = ids || (id ? [id] : []);

    if (!idsToDelete || idsToDelete.length === 0) {
      return res.status(400).json({ error: "No article ID(s) provided" });
    }

    const client = getDatabaseClient();
    let deletedCount = 0;

    for (const articleId of idsToDelete) {
      // Delete article tags first (foreign key constraint)
      await client.execute({
        sql: "DELETE FROM article_tags WHERE article_id = ?",
        args: [articleId],
      });

      // Delete article
      await client.execute({
        sql: "DELETE FROM articles WHERE id = ?",
        args: [articleId],
      });

      await logAdminAction({
        userId: user.id,
        userEmail: user.email,
        action: "DELETE_ARTICLE",
        resource: "article",
        resourceId: articleId,
        details: { bulk: idsToDelete.length > 1 },
        ipAddress: req.get("fly-client-ip") || req.ip,
        userAgent: req.get("user-agent"),
        success: true,
      });

      deletedCount++;
    }

    res.json({ success: true, deletedCount });
  } catch (error) {
    const user = (req as any).user;
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "DELETE_ARTICLE",
      resource: "article",
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Delete article error:", error);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

// DELETE /api/admin/articles/:id - Delete single article (URL parameter)
router.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    // Delete article tags first (foreign key constraint)
    await client.execute({
      sql: "DELETE FROM article_tags WHERE article_id = ?",
      args: [id],
    });

    // Delete article
    await client.execute({
      sql: "DELETE FROM articles WHERE id = ?",
      args: [id],
    });

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "DELETE_ARTICLE",
      resource: "article",
      resourceId: id,
      details: {},
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true });
  } catch (error) {
    const user = (req as any).user;
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "DELETE_ARTICLE",
      resource: "article",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Delete article error:", error);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

export default router;
