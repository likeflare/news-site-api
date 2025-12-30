import jwt from "jsonwebtoken";
import { tokenBlacklist } from "./tokenBlacklist";

/**
 * SECURITY: Separate secrets for access and refresh tokens with rotation support
 */

const ACCESS_TOKEN_SECRET = (() => {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("FATAL: JWT_SECRET or NEXTAUTH_SECRET environment variable not set!");
    if (process.env.NODE_ENV === "production") {
      console.error("Exiting due to missing JWT secret in production...");
      process.exit(1);
    }
    console.warn("WARNING: Using temporary JWT secret for development. DO NOT USE IN PRODUCTION!");
    return "dev-only-insecure-secret-change-before-deployment";
  }
  return secret;
})();

const REFRESH_TOKEN_SECRET = (() => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("FATAL: JWT_REFRESH_SECRET not set!");
    if (process.env.NODE_ENV === "production") {
      console.error("Exiting due to missing refresh token secret in production...");
      process.exit(1);
    }
    console.warn("WARNING: Using temporary refresh token secret for development.");
    return "dev-only-insecure-refresh-secret-change-before-deployment";
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
    { expiresIn: "1h" }
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
    { expiresIn: "7d" }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret()) as any;

    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    // SECURITY: Check if token is blacklisted
    if (tokenBlacklist.isBlacklisted(token) || tokenBlacklist.isUserRevoked(decoded.sub)) {
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

export function verifyRefreshToken(token: string): { sub: string; email: string; jti?: string } {
  try {
    const decoded = jwt.verify(token, getRefreshTokenSecret()) as any;

    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    // SECURITY: Check if token is blacklisted
    if (tokenBlacklist.isBlacklisted(token) || tokenBlacklist.isUserRevoked(decoded.sub)) {
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
export function revokeToken(token: string, expiresAt: number): void {
  tokenBlacklist.add(token, expiresAt, "Manual revocation");
}

/**
 * SECURITY: Revoke all tokens for a user
 */
export function revokeUserTokens(userId: string): void {
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  tokenBlacklist.revokeUserTokens(userId, expiresAt);
}
