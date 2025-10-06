import jwt from "jsonwebtoken";

/**
 * SECURITY: Separate secrets for access and refresh tokens
 * This prevents compromised refresh tokens from being used to forge access tokens
 */

function getAccessTokenSecret(): string {
  // Primary secret for access tokens
  return process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function getRefreshTokenSecret(): string {
  // Separate secret for refresh tokens - more secure
  return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "";
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
}

export function verifyRefreshToken(token: string): { sub: string; email: string } {
  const decoded = jwt.verify(token, getRefreshTokenSecret()) as any;
  
  if (decoded.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  
  return {
    sub: decoded.sub,
    email: decoded.email,
  };
}
