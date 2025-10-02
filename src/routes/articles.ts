import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// GET /api/articles - List articles
router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      limit = "20",
      offset = "0",
      categorySlug,
      authorSlug,
      tagSlug,
      featured,
      search,
    } = req.query;

    const client = getDatabaseClient();

    let query = `
      SELECT
        a.*,
        au.name as author_name,
        au.slug as author_slug,
        au.avatar_url as author_avatar_url,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color
      FROM articles a
      LEFT JOIN authors au ON a.author_id = au.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.is_published = 1
    `;

    const args: any[] = [];

    if (categorySlug) {
      query += ` AND c.slug = ?`;
      args.push(categorySlug);
    }

    if (authorSlug) {
      query += ` AND au.slug = ?`;
      args.push(authorSlug);
    }

    if (featured === "true") {
      query += ` AND a.is_featured = 1`;
    }

    if (search) {
      query += ` AND (a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)`;
      const searchPattern = `%${search}%`;
      args.push(searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY a.published_at_int DESC LIMIT ? OFFSET ?`;
    args.push(parseInt(limit as string), parseInt(offset as string));

    const result = await client.execute({ sql: query, args });

    res.json({ articles: result.rows });
  } catch (error) {
    console.error("Get articles error:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// GET /api/articles/:slug - Get single article
router.get("/:slug", optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT
          a.*,
          au.name as author_name,
          au.slug as author_slug,
          au.bio as author_bio,
          au.avatar_url as author_avatar_url,
          au.twitter_url as author_twitter_url,
          au.linkedin_url as author_linkedin_url,
          c.name as category_name,
          c.slug as category_slug,
          c.color as category_color,
          c.description as category_description
        FROM articles a
        LEFT JOIN authors au ON a.author_id = au.id
        LEFT JOIN categories c ON a.category_id = c.id
        WHERE a.slug = ? AND a.is_published = 1
      `,
      args: [slug],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Increment view count (async, don't wait)
    client.execute({
      sql: "UPDATE articles SET view_count = view_count + 1 WHERE id = ?",
      args: [result.rows[0].id],
    }).catch((err) => console.error("Failed to increment view count:", err));

    res.json({ article: result.rows[0] });
  } catch (error) {
    console.error("Get article error:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

export default router;
