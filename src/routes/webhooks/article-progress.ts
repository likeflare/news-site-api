import { Router } from "express";
import { getDatabaseClient } from "../../config/database";

const router = Router();

/**
 * PUBLIC ENDPOINT - n8n callback to update article idea progress
 * No authentication required (but validate webhook secret in production)
 */
router.post("/", async (req, res) => {
  try {
    const { id, progress, secret } = req.body;

    // Validate webhook secret (optional but recommended)
    const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      console.error("[article-progress] Invalid webhook secret");
      return res.status(401).json({ error: "Invalid webhook secret" });
    }

    // Validate required fields
    if (!id || !progress) {
      return res.status(400).json({ error: "Missing id or progress" });
    }

    // Validate progress value
    const validStates = ["pending", "started", "done", "failed"];
    if (!validStates.includes(progress)) {
      return res.status(400).json({
        error: `Invalid progress. Must be one of: ${validStates.join(", ")}`,
      });
    }

    const client = getDatabaseClient();
    const now = Date.now();

    console.log(`[article-progress] Updating idea ${id} to "${progress}"`);

    // Update progress with appropriate timestamps
    if (progress === "started") {
      await client.execute({
        sql: `UPDATE article_ideas SET progress = ?, progress_started_at = ? WHERE id = ?`,
        args: [progress, now, id],
      });
    } else if (progress === "done" || progress === "failed") {
      await client.execute({
        sql: `UPDATE article_ideas SET progress = ?, progress_completed_at = ? WHERE id = ?`,
        args: [progress, now, id],
      });
    } else {
      await client.execute({
        sql: `UPDATE article_ideas SET progress = ? WHERE id = ?`,
        args: [progress, id],
      });
    }

    console.log(`[article-progress] ✓ Updated idea ${id} to "${progress}"`);
    res.json({ success: true, progress, id });
  } catch (error) {
    console.error("[article-progress] Error:", error);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

export default router;
