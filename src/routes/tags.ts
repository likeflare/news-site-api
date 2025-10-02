import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// GET /api/tags - List all tags
router.get("/", optionalAuth, async (req, res) => {
  try {
    const client = getDatabaseClient();
    const query = `SELECT * FROM tags ORDER BY article_count DESC`;
    const result = await client.execute(query);

    const tags = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      article_count: Number(row.article_count) || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json({ tags });
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// GET /api/tags/:slug - Get single tag
router.get("/:slug", optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const client = getDatabaseClient();
    
    const query = `SELECT * FROM tags WHERE slug = ?`;
    const result = await client.execute({ sql: query, args: [slug] });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    const row = result.rows[0];
    const tag = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      article_count: Number(row.article_count) || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    res.json({ tag });
  } catch (error) {
    console.error("Get tag error:", error);
    res.status(500).json({ error: "Failed to fetch tag" });
  }
});

export default router;
