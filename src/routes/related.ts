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
    comment_count: Number(row.real_comment_count) || 0,
    is_featured: Boolean(row.is_featured),
    is_published: Boolean(row.is_published),
    published_at: row.published_at_int,
    created_at: row.created_at_int,
    updated_at: row.updated_at_int,
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

// GET /api/related?articleId=xxx&limit=3
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { articleId, limit = "3" } = req.query;

    if (!articleId) {
      return res.status(400).json({
        error: "articleId is required"
      });
    }

    const client = getDatabaseClient();
    const limitNum = parseInt(limit as string);

    // Strategy 1: Find articles with matching tags (best match)
    const tagBasedQuery = `
      SELECT DISTINCT
             a.id, a.title, a.slug, a.excerpt, a.content, a.tldr, a.image_url,
             a.author_id, a.category_id, a.read_time, a.view_count, a.like_count,
             a.is_featured, a.is_published,
             a.published_at_int, a.created_at_int, a.updated_at_int,
             (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as real_comment_count,
             au.name as author_name, au.slug as author_slug, au.bio as author_bio,
             au.avatar_url as author_avatar_url, au.twitter_url as author_twitter_url,
             au.linkedin_url as author_linkedin_url, au.title as author_title,
             au.email as author_email, au.join_date as author_join_date,
             au.article_count as author_article_count, au.follower_count as author_follower_count,
             au.award_count as author_award_count, au.expertise as author_expertise,
             au.created_at as author_created_at, au.updated_at as author_updated_at,
             c.name as category_name, c.slug as category_slug,
             c.description as category_description, c.color as category_color,
             c.created_at as category_created_at, c.updated_at as category_updated_at,
             COUNT(DISTINCT at2.tag_id) as matching_tags
      FROM articles a
      LEFT JOIN authors au ON a.author_id = au.id
      LEFT JOIN categories c ON a.category_id = c.id
      INNER JOIN article_tags at2 ON a.id = at2.article_id
      WHERE a.is_published = 1
        AND a.id != ?
        AND at2.tag_id IN (
          SELECT tag_id FROM article_tags WHERE article_id = ?
        )
      GROUP BY a.id
      ORDER BY matching_tags DESC, a.published_at_int DESC
      LIMIT ?
    `;

    let result = await client.execute({
      sql: tagBasedQuery,
      args: [String(articleId), String(articleId), limitNum],
    });

    let articles = result.rows.map(transformArticleRow);

    // Strategy 2: If not enough tag-based results, fill with same category
    if (articles.length < limitNum) {
      const articleResult = await client.execute({
        sql: "SELECT category_id FROM articles WHERE id = ?",
        args: [String(articleId)],
      });

      if (articleResult.rows.length > 0 && articleResult.rows[0].category_id) {
        const categoryId = articleResult.rows[0].category_id;
        const remaining = limitNum - articles.length;

        // Get existing article IDs to exclude
        const existingIds = articles.map(a => a.id);
        const placeholders = existingIds.length > 0
          ? ` AND a.id NOT IN (${existingIds.map(() => '?').join(',')})`
          : '';

        const categoryQuery = `
          SELECT
                 a.id, a.title, a.slug, a.excerpt, a.content, a.tldr, a.image_url,
                 a.author_id, a.category_id, a.read_time, a.view_count, a.like_count,
                 a.is_featured, a.is_published,
                 a.published_at_int, a.created_at_int, a.updated_at_int,
                 (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as real_comment_count,
                 au.name as author_name, au.slug as author_slug, au.bio as author_bio,
                 au.avatar_url as author_avatar_url, au.twitter_url as author_twitter_url,
                 au.linkedin_url as author_linkedin_url, au.title as author_title,
                 au.email as author_email, au.join_date as author_join_date,
                 au.article_count as author_article_count, au.follower_count as author_follower_count,
                 au.award_count as author_award_count, au.expertise as author_expertise,
                 au.created_at as author_created_at, au.updated_at as author_updated_at,
                 c.name as category_name, c.slug as category_slug,
                 c.description as category_description, c.color as category_color,
                 c.created_at as category_created_at, c.updated_at as category_updated_at
          FROM articles a
          LEFT JOIN authors au ON a.author_id = au.id
          LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.is_published = 1
            AND a.category_id = ?
            AND a.id != ?${placeholders}
          ORDER BY a.published_at_int DESC
          LIMIT ?
        `;

        const categoryResult = await client.execute({
          sql: categoryQuery,
          args: [String(categoryId), String(articleId), ...existingIds, remaining],
        });

        articles = [...articles, ...categoryResult.rows.map(transformArticleRow)];
      }
    }

    res.json({ articles });
  } catch (error) {
    console.error("Get related articles error:", error);
    res.status(500).json({ error: "Failed to fetch related articles" });
  }
});

export default router;
