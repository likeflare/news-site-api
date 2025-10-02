import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// Helper to parse JSON field
function parseJsonField(field: string | null): any[] {
  try {
    return field ? JSON.parse(field) : [];
  } catch {
    return [];
  }
}

// GET /api/authors - List all authors
router.get("/", optionalAuth, async (req, res) => {
  try {
    const client = getDatabaseClient();
    const query = `SELECT * FROM authors ORDER BY name`;
    const result = await client.execute(query);

    const authors = result.rows.map((row: any) => ({
      ...row,
      article_count: Number(row.article_count) || 0,
      follower_count: Number(row.follower_count) || 0,
      award_count: Number(row.award_count) || 0,
      expertise: parseJsonField(String(row.expertise || "")),
    }));

    res.json({ authors });
  } catch (error) {
    console.error("Get authors error:", error);
    res.status(500).json({ error: "Failed to fetch authors" });
  }
});

// GET /api/authors/:slug - Get single author
router.get("/:slug", optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const client = getDatabaseClient();
    
    const query = `SELECT * FROM authors WHERE slug = ?`;
    const result = await client.execute({ sql: query, args: [slug] });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Author not found" });
    }

    const row = result.rows[0];
    const author = {
      ...row,
      article_count: Number(row.article_count) || 0,
      follower_count: Number(row.follower_count) || 0,
      award_count: Number(row.award_count) || 0,
      expertise: parseJsonField(String(row.expertise || "")),
    };

    res.json({ author });
  } catch (error) {
    console.error("Get author error:", error);
    res.status(500).json({ error: "Failed to fetch author" });
  }
});

export default router;
