import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// GET /api/categories - List all categories
router.get("/", optionalAuth, async (req, res) => {
  try {
    const client = getDatabaseClient();
    const query = `SELECT * FROM categories ORDER BY name`;
    const result = await client.execute(query);

    const categories = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      color: row.color,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json({ categories });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/categories/:slug - Get single category
router.get("/:slug", optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const client = getDatabaseClient();
    
    const query = `SELECT * FROM categories WHERE slug = ?`;
    const result = await client.execute({ sql: query, args: [slug] });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const row = result.rows[0];
    const category = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      color: row.color,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    res.json({ category });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

export default router;
