import jwt from "jsonwebtoken";

/**
 * SECURITY: Separate secrets for access and refresh tokens
 * This prevents compromised refresh tokens from being used to forge access tokens
 */

// SECURITY FIX: Fail-fast if JWT secrets are not configured
const ACCESS_TOKEN_SECRET = (() => {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("FATAL: JWT_SECRET or NEXTAUTH_SECRET environment variable not set!");
    console.error("The application cannot start without a JWT secret for security.");
    // In production, this is critical - exit immediately
    if (process.env.NODE_ENV === "production") {
      console.error("Exiting due to missing JWT secret in production...");
      process.exit(1);
    }
    // In development, warn but use a temporary secret (for local testing only)
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
  sub: string;  // User ID
  email: string;
  name: string;
  role: string;
  image?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    {
      ...payload,
      type: "access",
    },
    getAccessTokenSecret(),
    { expiresIn: "1h" }
  );
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      type: "refresh",
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

    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      image: decoded.image,
    };
  } catch (error) {
    // Re-throw JWT errors as-is (expired, invalid signature, etc.)
    throw error;
  }
}

export function verifyRefreshToken(token: string): { sub: string; email: string } {
  try {
    const decoded = jwt.verify(token, getRefreshTokenSecret()) as any;

    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
    };
  } catch (error) {
    // Re-throw JWT errors as-is
    throw error;
  }
}
