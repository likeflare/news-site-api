import { Router } from "express";
import { getDatabaseClient } from "../config/database";
import { optionalAuth } from "../middleware/auth";
import { validateQuery, articlesQuerySchema } from "../middleware/validation";

const router = Router();

// GET /api/articles - List articles
router.get("/", optionalAuth, validateQuery(articlesQuerySchema), async (req, res) => {
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

    const user = (req as any).user;
    const client = getDatabaseClient();

    let query = `
      SELECT
        a.*,
        au.name as author_name,
        au.slug as author_slug,
        au.avatar_url as author_avatar_url,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color,
        COALESCE(COUNT(DISTINCT al.id), 0) as like_count,
        COALESCE(MAX(CASE WHEN al.user_id = ? THEN 1 ELSE 0 END), 0) as isLikedByUser
      FROM articles a
      LEFT JOIN authors au ON a.author_id = au.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN article_likes al ON a.id = al.article_id
      WHERE a.is_published = 1
    `;

    const args: any[] = [user?.id || ""];

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

    query += ` GROUP BY a.id ORDER BY a.published_at_int DESC LIMIT ? OFFSET ?`;
    args.push(parseInt(limit as string), parseInt(offset as string));

    const result = await client.execute({ sql: query, args });

    // Transform results to include like_count as number and isLikedByUser as boolean
    const articles = result.rows.map((row: any) => ({
      ...row,
      like_count: Number(row.like_count),
      isLikedByUser: Boolean(row.isLikedByUser),
    }));

    res.json({ articles });
  } catch (error) {
    console.error("Get articles error:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// GET /api/articles/:slug - Get single article
router.get("/:slug", optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const user = (req as any).user;
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
          au.article_count as author_article_count,
          au.follower_count as author_follower_count,
          c.name as category_name,
          c.slug as category_slug,
          c.color as category_color,
          c.description as category_description,
          COALESCE(COUNT(DISTINCT al.id), 0) as like_count,
          COALESCE(MAX(CASE WHEN al.user_id = ? THEN 1 ELSE 0 END), 0) as isLikedByUser
        FROM articles a
        LEFT JOIN authors au ON a.author_id = au.id
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN article_likes al ON a.id = al.article_id
        WHERE a.slug = ? AND a.is_published = 1
        GROUP BY a.id
      `,
      args: [user?.id || "", slug],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }

    const row = result.rows[0];

    // Transform result to include like_count as number and isLikedByUser as boolean
    const article: any = {
      ...row,
      like_count: Number(row.like_count),
      isLikedByUser: Boolean(row.isLikedByUser),
    };

    // Increment view count (async, don't wait)
    client.execute({
      sql: "UPDATE articles SET view_count = view_count + 1 WHERE id = ?",
      args: [row.id],
    }).catch((err) => console.error("Failed to increment view count:", err));

    res.json({ article });
  } catch (error) {
    console.error("Get article error:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

export default router;
