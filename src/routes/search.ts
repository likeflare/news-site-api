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

// Helper function to transform article data
function transformArticleRow(row: any): any {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    tldr: row.tldr,
    image_url: row.image_url,
    author_id: row.author_id,
    category_id: row.category_id,
    read_time: row.read_time,
    view_count: Number(row.view_count) || 0,
    like_count: Number(row.like_count) || 0,
    comment_count: Number(row.comment_count) || 0,
    is_featured: Boolean(row.is_featured),
    is_published: Boolean(row.is_published),
    published_at: row.published_at_int || row.published_at,
    created_at: row.created_at_int || row.created_at,
    updated_at: row.updated_at_int || row.updated_at,
    published_at_int: row.published_at_int,
    created_at_int: row.created_at_int,
    updated_at_int: row.updated_at_int,
    author: row.author_name
      ? {
          id: row.author_id,
          name: row.author_name,
          slug: row.author_slug,
          bio: row.author_bio,
          avatar_url: row.author_avatar_url,
          twitter_url: row.author_twitter_url,
          linkedin_url: row.author_linkedin_url,
          title: row.author_title,
          email: row.author_email,
          join_date: row.author_join_date,
          article_count: Number(row.author_article_count) || 0,
          follower_count: Number(row.author_follower_count) || 0,
          award_count: Number(row.author_award_count) || 0,
          expertise: parseJsonField(row.author_expertise),
          created_at: row.author_created_at,
          updated_at: row.author_updated_at,
        }
      : undefined,
    category: row.category_name
      ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          description: row.category_description,
          color: row.category_color,
          created_at: row.category_created_at,
          updated_at: row.category_updated_at,
        }
      : undefined,
  };
}

// GET /api/search?q=searchterm
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { q, limit = "20", offset = "0" } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query (q) is required" });
    }

    const client = getDatabaseClient();
    const searchPattern = `%${q}%`;

    const query = `
      SELECT
        a.*,
        au.name as author_name,
        au.slug as author_slug,
        au.bio as author_bio,
        au.avatar_url as author_avatar_url,
        au.twitter_url as author_twitter_url,
        au.linkedin_url as author_linkedin_url,
        au.title as author_title,
        au.email as author_email,
        au.join_date as author_join_date,
        au.article_count as author_article_count,
        au.follower_count as author_follower_count,
        au.award_count as author_award_count,
        au.expertise as author_expertise,
        au.created_at as author_created_at,
        au.updated_at as author_updated_at,
        c.name as category_name,
        c.slug as category_slug,
        c.description as category_description,
        c.color as category_color,
        c.created_at as category_created_at,
        c.updated_at as category_updated_at
      FROM articles a
      LEFT JOIN authors au ON a.author_id = au.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.is_published = 1
        AND (a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)
      ORDER BY a.published_at_int DESC
      LIMIT ? OFFSET ?
    `;

    const result = await client.execute({
      sql: query,
      args: [
        searchPattern, 
        searchPattern, 
        searchPattern,
        parseInt(limit as string),
        parseInt(offset as string)
      ],
    });

    const articles = result.rows.map(transformArticleRow);

    res.json({ 
      articles,
      query: q,
      count: articles.length 
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
