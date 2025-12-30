import jwt from "jsonwebtoken";
import { tokenBlacklist } from "./tokenBlacklist";
import { tokenBlacklistDb } from "./tokenBlacklistDb";

/**
 * SECURITY: Separate secrets for access and refresh tokens with rotation support
 */

const ACCESS_TOKEN_SECRET = (() => {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error(
      "FATAL: JWT_SECRET or NEXTAUTH_SECRET environment variable not set!",
    );
    console.error("Exiting application due to missing JWT secret...");
    process.exit(1);
  }
  if (secret.length < 32) {
    console.error(
      "FATAL: JWT_SECRET must be at least 32 characters long for security!",
    );
    console.error("Generate a secure secret with: openssl rand -base64 48");
    process.exit(1);
  }
  return secret;
})();

const REFRESH_TOKEN_SECRET = (() => {
  const secret =
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("FATAL: JWT_REFRESH_SECRET not set!");
    console.error("Exiting application due to missing refresh token secret...");
    process.exit(1);
  }
  if (secret.length < 32) {
    console.error(
      "FATAL: JWT_REFRESH_SECRET must be at least 32 characters long for security!",
    );
    console.error("Generate a secure secret with: openssl rand -base64 48");
    process.exit(1);
  }
  return secret;
})();

function getAccessTokenSecret(): string {
  return ACCESS_TOKEN_SECRET;
}

function getRefreshTokenSecret(): string {
  return REFRESH_TOKEN_SECRET;
}

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  image?: string;
  jti?: string; // JWT ID for tracking individual tokens
}

export function generateAccessToken(payload: TokenPayload): string {
  const jti = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return jwt.sign(
    {
      ...payload,
      type: "access",
      jti,
    },
    getAccessTokenSecret(),
    { expiresIn: "1h" },
  );
}

export function generateRefreshToken(payload: TokenPayload): string {
  const jti = `refresh-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      type: "refresh",
      jti,
    },
    getRefreshTokenSecret(),
    { expiresIn: "7d" },
  );
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret()) as any;

    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    // SECURITY: Check if token is blacklisted (check both in-memory and database)
    const isBlacklistedInMemory =
      tokenBlacklist.isBlacklisted(token) ||
      tokenBlacklist.isUserRevoked(decoded.sub);
    const isBlacklistedInDb = decoded.jti
      ? await tokenBlacklistDb.isBlacklisted(decoded.jti)
      : false;
    const isUserRevokedInDb = await tokenBlacklistDb.isUserRevoked(decoded.sub);

    if (isBlacklistedInMemory || isBlacklistedInDb || isUserRevokedInDb) {
      throw new Error("Token has been revoked");
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      image: decoded.image,
      jti: decoded.jti,
    };
  } catch (error) {
    throw error;
  }
}

export async function verifyRefreshToken(token: string): Promise<{
  sub: string;
  email: string;
  jti?: string;
}> {
  try {
    const decoded = jwt.verify(token, getRefreshTokenSecret()) as any;

    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    // SECURITY: Check if token is blacklisted (check both in-memory and database)
    const isBlacklistedInMemory =
      tokenBlacklist.isBlacklisted(token) ||
      tokenBlacklist.isUserRevoked(decoded.sub);
    const isBlacklistedInDb = decoded.jti
      ? await tokenBlacklistDb.isBlacklisted(decoded.jti)
      : false;
    const isUserRevokedInDb = await tokenBlacklistDb.isUserRevoked(decoded.sub);

    if (isBlacklistedInMemory || isBlacklistedInDb || isUserRevokedInDb) {
      throw new Error("Token has been revoked");
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      jti: decoded.jti,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * SECURITY: Revoke a specific token
 */
export async function revokeToken(
  jti: string,
  expiresAt: number,
  reason: string = "Manual revocation",
): Promise<void> {
  // Add to both in-memory and database for redundancy
  tokenBlacklist.add(jti, expiresAt, reason);
  await tokenBlacklistDb.add(jti, expiresAt, reason);
}

/**
 * SECURITY: Revoke all tokens for a user
 */
export async function revokeUserTokens(
  userId: string,
  reason: string = "User signout",
): Promise<void> {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  // Add to both in-memory and database for redundancy
  tokenBlacklist.revokeUserTokens(userId, expiresAt);
  await tokenBlacklistDb.revokeUserTokens(userId, expiresAt, reason);
}
