/**
 * SECURITY: Token Blacklist for Revocation
 */

interface BlacklistedToken {
  token: string;
  expiresAt: number;
  reason?: string;
}

class TokenBlacklist {
  private blacklist: Map<string, BlacklistedToken> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  add(token: string, expiresAt: number, reason?: string): void {
    this.blacklist.set(token, { token, expiresAt, reason });
  }

  isBlacklisted(token: string): boolean {
    const entry = this.blacklist.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.blacklist.delete(token);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [token, entry] of this.blacklist.entries()) {
      if (now > entry.expiresAt) {
        this.blacklist.delete(token);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[TokenBlacklist] Cleaned up ${removed} expired tokens`);
    }
  }

  size(): number {
    return this.blacklist.size;
  }

  revokeUserTokens(userId: string, expiresAt: number): void {
    this.add(`user:${userId}`, expiresAt, `User ${userId} tokens revoked`);
  }

  isUserRevoked(userId: string): boolean {
    return this.isBlacklisted(`user:${userId}`);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.blacklist.clear();
  }
}

export const tokenBlacklist = new TokenBlacklist();

process.on('SIGTERM', () => tokenBlacklist.destroy());
process.on('SIGINT', () => tokenBlacklist.destroy());
