import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";

const router = Router();

router.use(requireAdmin);
router.use(adminRateLimiter);

// GET /api/admin/categories
router.get("/", async (req, res) => {
  try {
    const client = getDatabaseClient();
    const result = await client.execute("SELECT * FROM categories ORDER BY name ASC");
    res.json({ categories: result.rows });
  } catch (error) {
    console.error("Admin get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/admin/categories
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const client = getDatabaseClient();

    const id = `cat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Math.floor(Date.now() / 1000);

    await client.execute({
      sql: `INSERT INTO categories (id, name, slug, description, color, created_at_int, updated_at_int)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.name, body.slug, body.description || null, body.color, now, now],
    });

    res.status(201).json({ success: true, id });
  } catch (error) {
    console.error("Admin create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/admin/categories/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const client = getDatabaseClient();

    await client.execute({
      sql: `UPDATE categories SET name = ?, slug = ?, description = ?, color = ?, updated_at_int = ? WHERE id = ?`,
      args: [body.name, body.slug, body.description || null, body.color, Math.floor(Date.now() / 1000), id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/admin/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    await client.execute({
      sql: "DELETE FROM categories WHERE id = ?",
      args: [id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
