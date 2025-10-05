import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";

const router = Router();

router.use(requireAdmin);
router.use(adminRateLimiter);

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

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const client = getDatabaseClient();
    const id = `category-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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

router.delete("/", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs array required" });
    }
    const client = getDatabaseClient();
    for (const id of ids) {
      await client.execute({ sql: "DELETE FROM categories WHERE id = ?", args: [id] });
    }
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Admin bulk delete categories error:", error);
    res.status(500).json({ error: "Failed to delete categories" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();
    const result = await client.execute({ sql: "SELECT * FROM categories WHERE id = ?", args: [id] });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error("Admin get category error:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

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

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();
    await client.execute({ sql: "DELETE FROM categories WHERE id = ?", args: [id] });
    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
