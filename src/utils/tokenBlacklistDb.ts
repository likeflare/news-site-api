import { getDatabaseClient } from "../config/database";

/**
 * Database-persisted token blacklist for distributed systems
 * Replaces in-memory solution to survive restarts and work across multiple servers
 */

class TokenBlacklistDb {
  private initialized = false;

  async init() {
    if (this.initialized) return;

    const client = getDatabaseClient();

    try {
      // Create token_blacklist table if it doesn't exist
      await client.execute(`
        CREATE TABLE IF NOT EXISTS token_blacklist (
          jti TEXT PRIMARY KEY,
          user_id TEXT,
          expires_at INTEGER NOT NULL,
          reason TEXT,
          created_at INTEGER NOT NULL
        )
      `);

      // Create index for efficient expiration cleanup
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires
        ON token_blacklist(expires_at)
      `);

      // Create index for user lookup
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_user
        ON token_blacklist(user_id)
      `);

      console.log("✅ Token blacklist database initialized");
      this.initialized = true;

      // Start cleanup job
      this.startCleanupJob();
    } catch (error) {
      console.error("Failed to initialize token blacklist database:", error);
      throw error;
    }
  }

  /**
   * Add a token to the blacklist
   */
  async add(jti: string, expiresAt: number, reason: string = "Revoked"): Promise<void> {
    await this.init();

    const client = getDatabaseClient();
    const now = Date.now();

    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO token_blacklist (jti, expires_at, reason, created_at)
              VALUES (?, ?, ?, ?)`,
        args: [jti, expiresAt, reason, now],
      });
    } catch (error) {
      console.error("Failed to blacklist token:", error);
      // Don't throw - blacklist failures shouldn't crash the app
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    await this.init();

    const client = getDatabaseClient();
    const now = Date.now();

    try {
      const result = await client.execute({
        sql: `SELECT 1 FROM token_blacklist
              WHERE jti = ? AND expires_at > ?
              LIMIT 1`,
        args: [jti, now],
      });

      return result.rows.length > 0;
    } catch (error) {
      console.error("Failed to check blacklist:", error);
      // Fail open - if we can't check, allow the token (logged for investigation)
      return false;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeUserTokens(userId: string, expiresAt: number, reason: string = "User signout"): Promise<void> {
    await this.init();

    const client = getDatabaseClient();
    const now = Date.now();
    const jti = `user-revoke-${userId}-${now}`;

    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO token_blacklist (jti, user_id, expires_at, reason, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [jti, userId, expiresAt, reason, now],
      });
    } catch (error) {
      console.error("Failed to revoke user tokens:", error);
    }
  }

  /**
   * Check if a user's tokens are revoked
   */
  async isUserRevoked(userId: string): Promise<boolean> {
    await this.init();

    const client = getDatabaseClient();
    const now = Date.now();

    try {
      const result = await client.execute({
        sql: `SELECT 1 FROM token_blacklist
              WHERE user_id = ? AND expires_at > ?
              LIMIT 1`,
        args: [userId, now],
      });

      return result.rows.length > 0;
    } catch (error) {
      console.error("Failed to check user revocation:", error);
      return false;
    }
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  async cleanup(): Promise<number> {
    await this.init();

    const client = getDatabaseClient();
    const now = Date.now();

    try {
      const result = await client.execute({
        sql: `DELETE FROM token_blacklist WHERE expires_at <= ?`,
        args: [now],
      });

      const deletedCount = result.rowsAffected || 0;
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired blacklisted tokens`);
      }
      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup blacklist:", error);
      return 0;
    }
  }

  /**
   * Get blacklist statistics for monitoring
   */
  async getStats(): Promise<{
    total: number;
    userRevocations: number;
    tokenRevocations: number;
  }> {
    await this.init();

    const client = getDatabaseClient();
    const now = Date.now();

    try {
      const totalResult = await client.execute({
        sql: `SELECT COUNT(*) as count FROM token_blacklist WHERE expires_at > ?`,
        args: [now],
      });

      const userRevokeResult = await client.execute({
        sql: `SELECT COUNT(*) as count FROM token_blacklist
              WHERE user_id IS NOT NULL AND expires_at > ?`,
        args: [now],
      });

      const total = Number(totalResult.rows[0]?.count || 0);
      const userRevocations = Number(userRevokeResult.rows[0]?.count || 0);

      return {
        total,
        userRevocations,
        tokenRevocations: total - userRevocations,
      };
    } catch (error) {
      console.error("Failed to get blacklist stats:", error);
      return { total: 0, userRevocations: 0, tokenRevocations: 0 };
    }
  }

  /**
   * Start periodic cleanup job (every 5 minutes)
   */
  private startCleanupJob() {
    const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

    setInterval(async () => {
      await this.cleanup();
    }, CLEANUP_INTERVAL);

    console.log("🔄 Token blacklist cleanup job started (runs every 5 minutes)");
  }
}

// Singleton instance
export const tokenBlacklistDb = new TokenBlacklistDb();
