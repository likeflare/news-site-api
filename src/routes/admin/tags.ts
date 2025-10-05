import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";

const router = Router();

router.use(requireAdmin);
router.use(adminRateLimiter);

// GET /api/admin/tags
router.get("/", async (req, res) => {
  try {
    const client = getDatabaseClient();
    const result = await client.execute("SELECT * FROM tags ORDER BY name ASC");
    res.json({ tags: result.rows });
  } catch (error) {
    console.error("Admin get tags error:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// POST /api/admin/tags
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const client = getDatabaseClient();

    const id = `tag-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Math.floor(Date.now() / 1000);

    await client.execute({
      sql: `INSERT INTO tags (id, name, slug, article_count, created_at_int, updated_at_int)
            VALUES (?, ?, ?, 0, ?, ?)`,
      args: [id, body.name, body.slug, now, now],
    });

    res.status(201).json({ success: true, id });
  } catch (error) {
    console.error("Admin create tag error:", error);
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// PUT /api/admin/tags - Update tag (ID in body for frontend compatibility)
router.put("/", async (req, res) => {
  try {
    const body = req.body;
    const id = body.id;
    
    if (!id) {
      return res.status(400).json({ error: "Tag ID required in body" });
    }

    const client = getDatabaseClient();

    await client.execute({
      sql: `UPDATE tags SET name = ?, slug = ?, updated_at_int = ? WHERE id = ?`,
      args: [body.name, body.slug, Math.floor(Date.now() / 1000), id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update tag error:", error);
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// DELETE /api/admin/tags - Bulk delete
router.delete("/", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs array required" });
    }

    const client = getDatabaseClient();

    // Delete all tags with provided IDs
    for (const id of ids) {
      await client.execute({
        sql: "DELETE FROM tags WHERE id = ?",
        args: [id],
      });
    }

    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Admin bulk delete tags error:", error);
    res.status(500).json({ error: "Failed to delete tags" });
  }
});

// PUT /api/admin/tags/:id - Update tag (alternative URL pattern)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const client = getDatabaseClient();

    await client.execute({
      sql: `UPDATE tags SET name = ?, slug = ?, updated_at_int = ? WHERE id = ?`,
      args: [body.name, body.slug, Math.floor(Date.now() / 1000), id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update tag error:", error);
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// DELETE /api/admin/tags/:id - Single delete
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    await client.execute({
      sql: "DELETE FROM tags WHERE id = ?",
      args: [id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete tag error:", error);
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
