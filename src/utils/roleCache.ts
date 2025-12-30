/**
 * In-Memory Role Cache
 *
 * Caches user roles for 1 hour to reduce database queries
 * Automatically invalidates on 401 errors
 */

interface CachedRole {
  email: string;
  role: string;
  cachedAt: number;
}

class RoleCache {
  private cache: Map<string, CachedRole> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor() {
    // Start cleanup job to remove expired entries every 15 minutes
    this.startCleanupJob();
  }

  /**
   * Get user role from cache or return null if expired/missing
   */
  get(email: string): string | null {
    const cached = this.cache.get(email.toLowerCase());

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.cachedAt;

    // Return cached role if less than 1 hour old
    if (age < this.CACHE_DURATION) {
      return cached.role;
    }

    // Expired - remove from cache
    this.cache.delete(email.toLowerCase());
    return null;
  }

  /**
   * Set user role in cache
   */
  set(email: string, role: string): void {
    this.cache.set(email.toLowerCase(), {
      email: email.toLowerCase(),
      role,
      cachedAt: Date.now(),
    });
  }

  /**
   * Force invalidate a user's cached role
   * Called when 401 error occurs
   */
  invalidate(email: string): void {
    this.cache.delete(email.toLowerCase());
  }

  /**
   * Clear all cached roles
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).map((entry) => ({
        email: entry.email,
        role: entry.role,
        age: Math.floor((Date.now() - entry.cachedAt) / 1000),
      })),
    };
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [email, cached] of this.cache.entries()) {
      const age = now - cached.cachedAt;
      if (age >= this.CACHE_DURATION) {
        this.cache.delete(email);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(
        `🧹 Role cache cleanup: removed ${removedCount} expired entries`,
      );
    }

    return removedCount;
  }

  /**
   * Start periodic cleanup job (every 15 minutes)
   */
  private startCleanupJob() {
    const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

    setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL);

    console.log("🔄 Role cache cleanup job started (runs every 15 minutes)");
  }
}

// Singleton instance
export const roleCache = new RoleCache();
