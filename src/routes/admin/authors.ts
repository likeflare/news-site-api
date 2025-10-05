import { Router } from "express";
import { getDatabaseClient } from "../../config/database";
import { requireAdmin } from "../../middleware/auth";
import { adminRateLimiter } from "../../middleware/rateLimit";

const router = Router();

// All admin routes require authentication
router.use(requireAdmin);
router.use(adminRateLimiter);

// GET /api/admin/authors - List all authors
router.get("/", async (req, res) => {
  try {
    const client = getDatabaseClient();
    const result = await client.execute("SELECT * FROM authors ORDER BY name ASC");
    res.json({ authors: result.rows });
  } catch (error) {
    console.error("Admin get authors error:", error);
    res.status(500).json({ error: "Failed to fetch authors" });
  }
});

// POST /api/admin/authors - Create author
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const client = getDatabaseClient();

    const id = `author-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Math.floor(Date.now() / 1000);

    await client.execute({
      sql: `INSERT INTO authors (
        id, name, slug, title, bio, avatar_url, location, website,
        twitter_url, linkedin_url, email, article_count, follower_count,
        award_count, expertise, join_date_int, created_at_int, updated_at_int
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.name,
        body.slug,
        body.title || null,
        body.bio || null,
        body.avatar_url || null,
        body.location || null,
        body.website || null,
        body.twitter_url || null,
        body.linkedin_url || null,
        body.email || null,
        0, 0, 0,
        JSON.stringify(body.expertise || []),
        now, now, now,
      ],
    });

    res.status(201).json({ success: true, id });
  } catch (error) {
    console.error("Admin create author error:", error);
    res.status(500).json({ error: "Failed to create author" });
  }
});

// PUT /api/admin/authors - Update author (ID in body for frontend compatibility)
router.put("/", async (req, res) => {
  try {
    const body = req.body;
    const id = body.id;
    
    if (!id) {
      return res.status(400).json({ error: "Author ID required in body" });
    }

    const client = getDatabaseClient();

    await client.execute({
      sql: `UPDATE authors SET
        name = ?, slug = ?, title = ?, bio = ?, avatar_url = ?,
        location = ?, website = ?, twitter_url = ?, linkedin_url = ?,
        email = ?, expertise = ?, updated_at_int = ?
      WHERE id = ?`,
      args: [
        body.name,
        body.slug,
        body.title || null,
        body.bio || null,
        body.avatar_url || null,
        body.location || null,
        body.website || null,
        body.twitter_url || null,
        body.linkedin_url || null,
        body.email || null,
        JSON.stringify(body.expertise || []),
        Math.floor(Date.now() / 1000),
        id,
      ],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update author error:", error);
    res.status(500).json({ error: "Failed to update author" });
  }
});

// DELETE /api/admin/authors - Bulk delete
router.delete("/", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs array required" });
    }
    const client = getDatabaseClient();
    for (const id of ids) {
      await client.execute({ sql: "DELETE FROM authors WHERE id = ?", args: [id] });
    }
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Admin bulk delete authors error:", error);
    res.status(500).json({ error: "Failed to delete authors" });
  }
});

// PUT /api/admin/authors/:id - Update author (alternative URL pattern)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const client = getDatabaseClient();

    await client.execute({
      sql: `UPDATE authors SET
        name = ?, slug = ?, title = ?, bio = ?, avatar_url = ?,
        location = ?, website = ?, twitter_url = ?, linkedin_url = ?,
        email = ?, expertise = ?, updated_at_int = ?
      WHERE id = ?`,
      args: [
        body.name,
        body.slug,
        body.title || null,
        body.bio || null,
        body.avatar_url || null,
        body.location || null,
        body.website || null,
        body.twitter_url || null,
        body.linkedin_url || null,
        body.email || null,
        JSON.stringify(body.expertise || []),
        Math.floor(Date.now() / 1000),
        id,
      ],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin update author error:", error);
    res.status(500).json({ error: "Failed to update author" });
  }
});

// DELETE /api/admin/authors/:id - Delete author
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = getDatabaseClient();

    await client.execute({
      sql: "DELETE FROM authors WHERE id = ?",
      args: [id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete author error:", error);
    res.status(500).json({ error: "Failed to delete author" });
  }
});

export default router;
