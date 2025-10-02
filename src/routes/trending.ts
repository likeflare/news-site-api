import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// GET /api/trending - Get trending articles
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { limit = "5" } = req.query;
    const client = getDatabaseClient();

    const query = `
      SELECT
        a.id,
        a.title,
        a.slug,
        a.view_count,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.is_published = 1
      ORDER BY a.view_count DESC, a.published_at_int DESC
      LIMIT ?
    `;

    const result = await client.execute({ 
      sql: query, 
      args: [parseInt(limit as string)] 
    });

    const articles = result.rows.map((row: any, index: number) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      view_count: Number(row.view_count) || 0,
      category: row.category_name || "General",
      category_slug: row.category_slug,
      category_color: row.category_color,
      rank: index + 1,
    }));

    res.json({ articles });
  } catch (error) {
    console.error("Get trending articles error:", error);
    res.status(500).json({ error: "Failed to fetch trending articles" });
  }
});

export default router;
