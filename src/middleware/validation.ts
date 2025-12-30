import { z } from "zod";
import { Request, Response, NextFunction } from "express";

const MAX_TEXT_LENGTH = 10000;
const MAX_SEARCH_LENGTH = 200;
const MAX_EMAIL_LENGTH = 255;

export const emailSchema = z.string()
  .email("Invalid email format")
  .max(MAX_EMAIL_LENGTH, "Email too long")
  .trim()
  .toLowerCase();

export const searchSchema = z.string()
  .max(MAX_SEARCH_LENGTH, "Search query too long")
  .trim();

export const articlesQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  categorySlug: z.string().max(100).optional(),
  authorSlug: z.string().max(100).optional(),
  tagSlug: z.string().max(100).optional(),
  featured: z.enum(["true", "false"]).optional(),
  search: z.string().max(MAX_SEARCH_LENGTH).optional(),
}).passthrough();

export const searchQuerySchema = z.object({
  q: z.string().max(MAX_SEARCH_LENGTH).optional(),
  limit: z.string().optional(),
}).passthrough();

export const relatedQuerySchema = z.object({
  articleId: z.string().max(100).optional(),
  limit: z.string().optional(),
}).passthrough();

export const commentsQuerySchema = z.object({
  articleId: z.string().max(100).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
}).passthrough();

export const commentSchema = z.object({
  articleId: z.string().max(100),
  content: z.string().min(1).max(MAX_TEXT_LENGTH).trim(),
  parentId: z.string().max(100).optional().nullable(),
});

export const createCommentSchema = commentSchema;

export const updateCommentSchema = z.object({
  id: z.string().max(100),
  content: z.string().min(1).max(MAX_TEXT_LENGTH).trim().optional(),
  is_approved: z.boolean().optional(),
});

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

export function sanitizeSQLLikePattern(pattern: string): string {
  return pattern
    .replace(/[%_\\]/g, '\\$&')
    .substring(0, MAX_SEARCH_LENGTH);
}
