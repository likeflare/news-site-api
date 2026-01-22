import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";
import { sanitizeText } from "../../middleware/sanitize";
import { logAdminAction } from "../../utils/auditLog";

const router = Router();

// SECURITY: Apply admin authentication and rate limiting to all routes
router.use(requireAdmin);
router.use(adminRateLimiter);

// GET /api/admin/article-ideas - List all article ideas
router.get("/", async (req, res) => {
  const user = (req as any).user;
  try {
    const client = getDatabaseClient();
    const result = await client.execute({
      sql: `SELECT
            id, article_title, article_summary, date_added, generated, category, progress, progress_started_at, progress_completed_at, progress, progress_started_at, progress_completed_at
            FROM article_ideas
            ORDER BY date_added DESC`,
      args: [],
    });

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "LIST_ARTICLE_IDEAS",
      resource: "article_ideas",
      details: { count: result.rows.length },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ ideas: result.rows, total: result.rows.length });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "LIST_ARTICLE_IDEAS",
      resource: "article_ideas",
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Get article ideas error:", error);
    res.status(500).json({ error: "Failed to fetch article ideas" });
  }
});

// GET /api/admin/article-ideas/:id - Get single article idea by ID
router.get("/:id", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `SELECT
            id, article_title, article_summary, date_added, generated, category, progress, progress_started_at, progress_completed_at, progress, progress_started_at, progress_completed_at
            FROM article_ideas
            WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article idea not found" });
    }

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "VIEW_ARTICLE_IDEA",
      resource: "article_ideas",
      resourceId: id,
      details: { title: result.rows[0].article_title },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ idea: result.rows[0] });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "VIEW_ARTICLE_IDEA",
      resource: "article_ideas",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Get article idea by ID error:", error);
    res.status(500).json({ error: "Failed to fetch article idea" });
  }
});

// POST /api/admin/article-ideas - Create new article idea
router.post("/", async (req, res) => {
  const user = (req as any).user;
  try {
    const body = req.body;
    const client = getDatabaseClient();
    const now = Date.now();

    // SECURITY: Sanitize all text inputs
    const sanitizedTitle = body.article_title
      ? sanitizeText(body.article_title)
      : null;
    const sanitizedSummary = body.article_summary
      ? sanitizeText(body.article_summary)
      : null;
    const sanitizedCategory = body.category ? sanitizeText(body.category) : null;

    // Validate required fields
    if (!sanitizedTitle) {
      return res.status(400).json({ error: "Article title is required" });
    }

    await client.execute({
      sql: `INSERT INTO article_ideas (
        article_title, article_summary, date_added, generated, category
      ) VALUES (?, ?, ?, ?, ?)`,
      args: [
        sanitizedTitle,
        sanitizedSummary,
        body.date_added || now,
        body.generated ? 1 : 0,
        sanitizedCategory,
      ],
    });

    // Get the last inserted ID
    const lastIdResult = await client.execute({
      sql: "SELECT last_insert_rowid() as id",
      args: [],
    });
    const newId = lastIdResult.rows[0]?.id;

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "CREATE_ARTICLE_IDEA",
      resource: "article_ideas",
      resourceId: String(newId),
      details: { title: sanitizedTitle },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true, id: newId });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "CREATE_ARTICLE_IDEA",
      resource: "article_ideas",
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Create article idea error:", error);
    res.status(500).json({ error: "Failed to create article idea" });
  }
});

// PUT /api/admin/article-ideas/:id - Update article idea
router.put("/:id", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const body = req.body;
    const client = getDatabaseClient();

    // SECURITY: Sanitize all text inputs
    const updates: any = {};
    if (body.article_title !== undefined) {
      updates.article_title = sanitizeText(body.article_title);
    }
    if (body.article_summary !== undefined) {
      updates.article_summary = sanitizeText(body.article_summary);
    }
    if (body.category !== undefined) {
      updates.category = sanitizeText(body.category);
    }
    if (body.generated !== undefined) {
      updates.generated = body.generated ? 1 : 0;
    }
    if (body.date_added !== undefined) {
      updates.date_added = body.date_added;
    }

    // Build update query
    const updateFields = Object.keys(updates);
    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const setFields = updateFields.map((key) => `${key} = ?`).join(", ");
    const values = [...updateFields.map((key) => updates[key]), id];

    await client.execute({
      sql: `UPDATE article_ideas SET ${setFields} WHERE id = ?`,
      args: values,
    });

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE_ARTICLE_IDEA",
      resource: "article_ideas",
      resourceId: id,
      details: { fields: updateFields },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE_ARTICLE_IDEA",
      resource: "article_ideas",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Update article idea error:", error);
    res.status(500).json({ error: "Failed to update article idea" });
  }
});

// DELETE /api/admin/article-ideas/:id - Delete article idea
router.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    // Get idea details before deletion for logging
    const ideaResult = await client.execute({
      sql: "SELECT article_title FROM article_ideas WHERE id = ?",
      args: [id],
    });

    if (ideaResult.rows.length === 0) {
      return res.status(404).json({ error: "Article idea not found" });
    }

    await client.execute({
      sql: "DELETE FROM article_ideas WHERE id = ?",
      args: [id],
    });

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "DELETE_ARTICLE_IDEA",
      resource: "article_ideas",
      resourceId: id,
      details: { title: ideaResult.rows[0].article_title },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "DELETE_ARTICLE_IDEA",
      resource: "article_ideas",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Delete article idea error:", error);
    res.status(500).json({ error: "Failed to delete article idea" });
  }
});

// PATCH /api/admin/article-ideas/:id/generated - Toggle generated status
router.patch("/:id/generated", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const { generated } = req.body;

    const client = getDatabaseClient();

    await client.execute({
      sql: `UPDATE article_ideas SET generated = ? WHERE id = ?`,
      args: [generated ? 1 : 0, id],
    });

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: generated ? "MARK_IDEA_GENERATED" : "MARK_IDEA_PENDING",
      resource: "article_ideas",
      resourceId: id,
      details: { generated },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true, generated });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "TOGGLE_GENERATED",
      resource: "article_ideas",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Toggle generated error:", error);
    res.status(500).json({ error: "Failed to toggle generated status" });
  }
});


// PATCH /api/admin/article-ideas/:id/progress - Update progress status
router.patch("/:id/progress", async (req, res) => {
  const user = (req as any).user;
  try {
    const { id } = req.params;
    const { progress } = req.body;

    // Validate progress value
    const validStates = ["pending", "started", "done", "failed"];
    if (!validStates.includes(progress)) {
      return res.status(400).json({ error: `Invalid progress state. Must be one of: ${validStates.join(", ")}` });
    }

    const client = getDatabaseClient();
    const now = Date.now();

    // Update progress with appropriate timestamps
    if (progress === "started") {
      await client.execute({
        sql: `UPDATE article_ideas SET progress = ?, progress_started_at = ? WHERE id = ?`,
        args: [progress, now, id],
      });
    } else if (progress === "done" || progress === "failed") {
      await client.execute({
        sql: `UPDATE article_ideas SET progress = ?, progress_completed_at = ? WHERE id = ?`,
        args: [progress, now, id],
      });
    } else {
      await client.execute({
        sql: `UPDATE article_ideas SET progress = ? WHERE id = ?`,
        args: [progress, id],
      });
    }

    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE_ARTICLE_IDEA_PROGRESS",
      resource: "article_ideas",
      resourceId: id,
      details: { progress },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });

    res.json({ success: true, progress });
  } catch (error) {
    await logAdminAction({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE_ARTICLE_IDEA_PROGRESS",
      resource: "article_ideas",
      resourceId: req.params.id,
      details: { error: (error as Error).message },
      ipAddress: req.get("fly-client-ip") || req.ip,
      userAgent: req.get("user-agent"),
      success: false,
    });
    console.error("Update progress error:", error);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

export default router;
