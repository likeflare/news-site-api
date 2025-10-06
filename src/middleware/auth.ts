import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/tokens";

export interface JWTPayload {
  sub?: string;  // User ID
  email?: string;
  name?: string;
  role?: string;
  image?: string; // User avatar
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // SECURITY: Use separate access token secret for verification
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    (req as any).user = {
      id: decoded.sub || "",
      email: decoded.email || "",
      name: decoded.name || "",
      role: decoded.role || "user",
      image: decoded.image || null,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  verifyToken(req, res, next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  verifyToken(req, res, (err) => {
    if (err) return;

    const user = (req as any).user;

    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  });
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No auth provided, continue without user
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyAccessToken(token);

    (req as any).user = {
      id: decoded.sub || "",
      email: decoded.email || "",
      name: decoded.name || "",
      role: decoded.role || "user",
      image: decoded.image || null,
    };
  } catch (error) {
    // Invalid token, but don't fail - just continue without user
    console.warn("Invalid token provided (non-fatal):", error);
  }

  next();
}
